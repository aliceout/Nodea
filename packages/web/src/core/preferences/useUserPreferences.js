/**
 * Hook + cache helpers used to hydrate, subscribe to and persist user-level preferences.
 * The module keeps an in-memory cache per user and rebroadcasts updates across every
 * component currently mounted for that user.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import useAuth from "@/core/auth/useAuth";
import {
  loadUserPreferences,
  saveUserPreferences,
} from "@/core/api/user-preferences";
import { KeyMissingError } from "@/core/crypto/webcrypto";

const preferencesCache = new Map();
const inflightFetches = new Map();
const subscribersByUser = new Map();

/**
 * Notify every subscriber attached to a given user that their preferences changed.
 *
 * @param {string|null} userId - PocketBase user identifier.
 * @param {Record<string, any>} preferences - The preference payload to forward.
 */
function broadcastPreferences(userId, preferences) {
  if (!userId) return;
  const listeners = subscribersByUser.get(userId);
  if (!listeners || listeners.size === 0) return;
  const payload =
    preferences && typeof preferences === "object" ? { ...preferences } : {};
  for (const listener of Array.from(listeners)) {
    try {
      listener(payload);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[useUserPreferences] listener error", error);
      }
    }
  }
}

/**
 * Safely read the cached preferences for the provided user id.
 *
 * @param {string|null} userId - PocketBase user identifier.
 * @returns {Record<string, any>} A cloned preference object or an empty object.
 */
function getInitialPreferences(userId) {
  if (!userId) return {};
  const cached = preferencesCache.get(userId);
  return cached ? { ...cached } : {};
}

/**
 * Store fresh preferences in the cache and broadcast them to listeners.
 *
 * @param {string} userId - PocketBase user identifier.
 * @param {Record<string, any>} data - Preference payload fetched from the API.
 */
function finalizeFetch(userId, data) {
  if (!userId) return;
  const safe = data && typeof data === "object" ? { ...data } : {};
  preferencesCache.set(userId, safe);
  broadcastPreferences(userId, safe);
}

/**
 * React hook that exposes user preference state, loading flags and mutation helpers.
 * The hook keeps its local state in sync with the shared cache so multiple mounts stay aligned.
 *
 * @returns {{
 *   preferences: Record<string, any>,
 *   isLoading: boolean,
 *   isSaving: boolean,
 *   setPreferences: (next: Record<string, any>, options?: {persist?: boolean}) => Promise<Record<string, any>>,
 *   updatePreferences: (updater: ((prev: Record<string, any>) => Record<string, any>) | Record<string, any>) => Promise<Record<string, any>>,
 *   refreshPreferences: () => Promise<Record<string, any>>
 * }}
 */
export function useUserPreferences() {
  const { mainKey, markMissing } = useStore();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [preferences, setPreferences] = useState(() =>
    getInitialPreferences(userId)
  );
  const [isLoading, setIsLoading] = useState(() => {
    if (!userId || !mainKey) return false;
    return !preferencesCache.has(userId);
  });
  const [isSaving, setIsSaving] = useState(false);
  const latestPreferencesRef = useRef(preferences);

  useEffect(() => {
    latestPreferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (!userId || !mainKey) {
      setPreferences({});
      setIsLoading(false);
      return undefined;
    }

    const listener = (next) => {
      setPreferences(next && typeof next === "object" ? { ...next } : {});
    };
    let pool = subscribersByUser.get(userId);
    if (!pool) {
      pool = new Set();
      subscribersByUser.set(userId, pool);
    }
    pool.add(listener);

    return () => {
      pool.delete(listener);
      if (pool.size === 0) {
        subscribersByUser.delete(userId);
      }
    };
  }, [userId, mainKey]);

  useEffect(() => {
    if (!userId || !mainKey) {
      setPreferences({});
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      setIsLoading(true);
      try {
        if (preferencesCache.has(userId)) {
          const cached = preferencesCache.get(userId) || {};
          if (!cancelled) {
            setPreferences({ ...cached });
            setIsLoading(false);
          }
          return;
        }

        let promise = inflightFetches.get(userId);
        if (!promise) {
          promise = loadUserPreferences(pb, userId, mainKey);
          inflightFetches.set(userId, promise);
        }

        const remote = await promise;
        inflightFetches.delete(userId);

        if (cancelled) return;
        finalizeFetch(userId, remote || {});
      } catch (error) {
        inflightFetches.delete(userId);
        if (error instanceof KeyMissingError) {
          markMissing?.();
        } else if (process.env.NODE_ENV === "development") {
          console.error("[useUserPreferences] load error", error);
        }
        if (!cancelled) {
          setPreferences({});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [userId, mainKey, markMissing]);

  const overwritePreferences = useCallback(
    (nextPreferences, options = { persist: true }) => {
      const safe = nextPreferences && typeof nextPreferences === "object"
        ? { ...nextPreferences }
        : {};
      setPreferences(safe);
      if (userId) {
        preferencesCache.set(userId, safe);
        broadcastPreferences(userId, safe);
      }
      const shouldPersist = options?.persist ?? true;
      if (!shouldPersist) {
        return Promise.resolve(safe);
      }

      if (!userId || !mainKey) {
        return Promise.resolve(safe);
      }

      setIsSaving(true);
      return saveUserPreferences(pb, userId, mainKey, safe)
        .then(() => safe)
        .catch((error) => {
          if (error instanceof KeyMissingError) {
            markMissing?.();
          } else {
            console.error("[useUserPreferences] save error", error);
          }
          // Revert to latest known preferences on failure.
          const fallback = latestPreferencesRef.current || {};
          const safeFallback = { ...fallback };
          setPreferences(safeFallback);
          if (userId) {
            preferencesCache.set(userId, safeFallback);
            broadcastPreferences(userId, safeFallback);
          }
          throw error;
        })
        .finally(() => {
          setIsSaving(false);
        });
    },
    [userId, mainKey, markMissing]
  );

  const updatePreferences = useCallback(
    async (updater) => {
      const base = latestPreferencesRef.current || {};
      const next =
        typeof updater === "function" ? updater({ ...base }) : updater || {};
      return overwritePreferences(next);
    },
    [overwritePreferences]
  );

  const refreshPreferences = useCallback(async () => {
    if (!userId || !mainKey) return {};
    try {
      const fresh = await loadUserPreferences(pb, userId, mainKey);
      finalizeFetch(userId, fresh || {});
      return fresh || {};
    } catch (error) {
      if (error instanceof KeyMissingError) {
        markMissing?.();
      } else {
        console.error("[useUserPreferences] refresh error", error);
      }
      return {};
    }
  }, [userId, mainKey, markMissing]);

  return {
    preferences,
    isLoading,
    isSaving,
    setPreferences: overwritePreferences,
    updatePreferences,
    refreshPreferences,
  };
}

/**
 * Read the cached preferences synchronously without subscribing.
 *
 * @param {string|null} userId - PocketBase user identifier.
 * @returns {Record<string, any>|null} The cached preferences clone or null when missing.
 */
export function getCachedUserPreferences(userId) {
  return userId ? preferencesCache.get(userId) || null : null;
}

/**
 * Seed the per-user preference cache without triggering a network fetch.
 *
 * @param {string|null} userId - PocketBase user identifier.
 * @param {Record<string, any>} preferences - Preference payload to cache.
 */
export function primeCachedUserPreferences(userId, preferences) {
  if (!userId) return;
  const safe =
    preferences && typeof preferences === "object" ? { ...preferences } : {};
  preferencesCache.set(userId, safe);
}
