/**
 * Hook : centralises the « is this module hydrated and ready to
 * make encrypted API calls » guard that was previously repeated
 * 20 times across module contexts and composer bodies.
 *
 * **Before** — every caller did the same dance :
 *
 *   const mainKey = useNodeaStore(selectMainKey);
 *   const modules = useNodeaStore(selectModules);
 *   const moduleUserId = modules['goals']?.moduleUserId ?? null;
 *   useEffect(() => {
 *     if (!mainKey || !moduleUserId) return;
 *     // … fetch / mutate using mainKey + moduleUserId
 *   }, [mainKey, moduleUserId, …]);
 *
 * **After** — `useModuleClient` returns either `null` (not yet
 * hydrated) or the narrowed `{ mainKey, moduleUserId }` pair :
 *
 *   const ctx = useModuleClient('goals');
 *   useEffect(() => {
 *     if (!ctx) return;
 *     // … fetch using ctx.mainKey, ctx.moduleUserId
 *   }, [ctx, …]);
 *
 * **Three benefits**
 *   1. Single source of truth for what "hydrated" means. If the
 *      definition ever changes (e.g. add a freshness check), one
 *      edit in this file ; before, 20 sites to find and update.
 *   2. Types narrow downstream — once you've checked `ctx`, both
 *      fields are non-null by construction. No need to re-narrow
 *      `mainKey | null` in every callback.
 *   3. Shorter dep arrays for `useEffect` / `useCallback` (one
 *      `ctx` reference instead of two separate ones).
 *
 * **Stability contract.** The returned object is memoised against
 * `mainKey` + `moduleUserId` — as long as both values are stable
 * across re-renders, `ctx` keeps the same identity and the
 * downstream `useEffect` / `useCallback` don't fire unnecessarily.
 */
import { useMemo } from 'react';

import {
  selectMainKey,
  selectModules,
  useNodeaStore,
} from '@/core/store/nodea-store';
import type { MainKeyMaterial } from '@/core/crypto/key-material';

export interface ModuleClient {
  /** AES + HMAC sub-keys derived from the user's main key. Both
   *  non-extractable `CryptoKey`s, never serialised. */
  mainKey: MainKeyMaterial;
  /** Opaque per-module sid, the access scope identifier the api
   *  expects in the `X-Sid` header. */
  moduleUserId: string;
}

export function useModuleClient(moduleId: string): ModuleClient | null {
  const mainKey = useNodeaStore(selectMainKey);
  const moduleUserId = useNodeaStore(
    (s) => selectModules(s)[moduleId]?.moduleUserId ?? null,
  );
  return useMemo<ModuleClient | null>(
    () => (mainKey && moduleUserId ? { mainKey, moduleUserId } : null),
    [mainKey, moduleUserId],
  );
}
