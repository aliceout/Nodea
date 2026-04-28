import { useCallback, useEffect, useRef, useState } from 'react';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import type { Base64, CipherIV, EncryptedBlob } from '@nodea/shared';
import { useNodeaStore, selectMainKey } from '@/core/store/nodea-store';
import type { ReviewPayload } from '@nodea/shared';

/**
 * Auto-save for in-progress review drafts.
 *
 * The draft never touches localStorage in clear: payload is encrypted
 * with the user's AES key before write, and decrypted on read. If the
 * stored ciphertext can't be decoded with the current key (stale, wrong
 * user), we silently drop it — the user gets a fresh start.
 *
 * Storage key layout: `nodea:review:draft:<year>`. Keeping separate
 * slots per year lets the user step between drafts without collisions.
 */

const DEBOUNCE_MS = 800;
const STORAGE_PREFIX = 'nodea:review:draft:';

function storageKey(year: number): string {
  return `${STORAGE_PREFIX}${year}`;
}

async function encode(key: MainKeyMaterial, payload: ReviewPayload): Promise<string> {
  const blob = await encryptAESGCM(JSON.stringify(payload), key.aesKey);
  // savedAt sits OUTSIDE the encrypted blob so the draft list can
  // surface a « modifié le … » timestamp without paying the cost
  // of decrypting every slot. It's not sensitive — it leaks the
  // mtime of the file to anyone with localStorage access (already
  // visible via the browser's storage panel).
  return JSON.stringify({ iv: blob.iv, data: blob.data, savedAt: Date.now() });
}

async function decode(key: MainKeyMaterial, raw: string): Promise<ReviewPayload | null> {
  try {
    const parsed = JSON.parse(raw) as { iv: string; data: string };
    const plain = await decryptAESGCM(
      { iv: parsed.iv as Base64 as CipherIV, data: parsed.data as Base64 as EncryptedBlob },
      key.aesKey,
    );
    return JSON.parse(plain) as ReviewPayload;
  } catch {
    return null;
  }
}

export interface DraftSummary {
  /** Year the draft was started for. */
  year: number;
  /** Last save timestamp (ms epoch), or null if the draft predates
   *  the savedAt-tracking format (older entries). */
  savedAt: number | null;
}

/**
 * Enumerate every encrypted Review draft sitting in localStorage,
 * regardless of whether the AES key is currently in memory. Useful
 * for the list view to show resumable drafts without forcing a
 * decryption cost for slots the user may never open.
 *
 * The year is parsed from the storage key suffix; savedAt is read
 * from the JSON wrapper (outside the encrypted payload).
 */
export function listReviewDrafts(): DraftSummary[] {
  const out: DraftSummary[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    const yr = Number(k.slice(STORAGE_PREFIX.length));
    if (!Number.isFinite(yr)) continue;
    let savedAt: number | null = null;
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw) as { savedAt?: number };
        if (typeof parsed.savedAt === 'number') savedAt = parsed.savedAt;
      }
    } catch {
      // Stored slot isn't JSON — ignore the timestamp, still list
      // the year so the user can wipe it.
    }
    out.push({ year: yr, savedAt });
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Wipe a single year's draft from localStorage. Mirrors the
 *  hook's `clear()` for sites that don't have the hook handy. */
export function clearReviewDraft(year: number): void {
  localStorage.removeItem(storageKey(year));
}

export interface DraftControls {
  /** Last successfully persisted draft for this year, or null. */
  hydrated: ReviewPayload | null;
  /** True until we've checked the store once on mount. */
  hydrating: boolean;
  save(payload: ReviewPayload): void;
  clear(): void;
  saving: boolean;
  lastSavedAt: number | null;
}

export function useDraft(year: number): DraftControls {
  const mainKey = useNodeaStore(selectMainKey);
  const [hydrated, setHydrated] = useState<ReviewPayload | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const pending = useRef<ReviewPayload | null>(null);
  const timer = useRef<number | null>(null);

  // Hydrate once per (key, year) change.
  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    setHydrated(null);
    if (!mainKey) {
      setHydrating(false);
      return;
    }
    const raw = localStorage.getItem(storageKey(year));
    if (!raw) {
      setHydrating(false);
      return;
    }
    void decode(mainKey, raw).then((p) => {
      if (cancelled) return;
      setHydrated(p);
      setHydrating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mainKey, year]);

  const flush = useCallback(async () => {
    if (!mainKey) return;
    const payload = pending.current;
    if (!payload) return;
    setSaving(true);
    try {
      const encoded = await encode(mainKey, payload);
      localStorage.setItem(storageKey(year), encoded);
      setLastSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [mainKey, year]);

  const save = useCallback(
    (payload: ReviewPayload) => {
      pending.current = payload;
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  const clear = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    pending.current = null;
    localStorage.removeItem(storageKey(year));
    setHydrated(null);
    setLastSavedAt(null);
  }, [year]);

  // On unmount, flush any pending save synchronously.
  useEffect(() => {
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  return { hydrated, hydrating, save, clear, saving, lastSavedAt };
}
