/**
 * Guard derivation for encrypted records.
 *
 * A record's `guard` is a deterministic HMAC-SHA-256 tag computed
 * client-side from:
 *
 *   guardKey  = HMAC(hmacMainKey, "guard:" + moduleUserId)
 *   guardTag  = HMAC(guardKey, recordId)
 *   finalStr  = "g_" + hex(guardTag)
 *
 * The server stores `finalStr` and, on every mutation, verifies the
 * client provides the same value (timing-safe). Because only the user
 * holds the HMAC main-key sub-key, nobody else (including the server)
 * can forge a valid guard — a compromised server cannot silently tamper
 * with records.
 *
 * Difference vs. the legacy `guards.js`:
 *   - The cache is in-memory only (Map keyed by collection + id).
 *     Nothing is written to `localStorage`; it is purged at logout via
 *     {@link clearGuardsCache}.
 *   - The input key is the HMAC sub-key (HmacMainKey), not the raw main
 *     key doubly-imported as AES and HMAC.
 */
import type { HmacMainKey } from '@nodea/shared/crypto-types';
import { hmacSha256 } from './hmac.ts';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Compute a record's stable `g_<hex>` guard.
 *
 * @throws if `moduleUserId` or `recordId` is falsy.
 */
export async function deriveGuard(
  hmacKey: HmacMainKey,
  moduleUserId: string,
  recordId: string,
): Promise<string> {
  if (!moduleUserId) throw new Error('deriveGuard: moduleUserId is required');
  if (!recordId) throw new Error('deriveGuard: recordId is required');

  // Intermediate derivation: key scoped to the module so two modules with
  // the same recordId produce different guards.
  const scopedBytes = await hmacSha256(hmacKey, `guard:${moduleUserId}`);

  // Import the scoped bytes as a one-shot HMAC key for the second pass.
  const scopedKey = (await crypto.subtle.importKey(
    'raw',
    scopedBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )) as HmacMainKey;
  try {
    const tag = await hmacSha256(scopedKey, recordId);
    return `g_${bytesToHex(tag)}`;
  } finally {
    scopedBytes.fill(0);
  }
}

// --- In-memory cache ---------------------------------------------------

type CollectionKey = string;
type RecordId = string;

const cache = new Map<CollectionKey, Map<RecordId, string>>();

export function setEntryGuard(collection: string, recordId: string, guard: string): void {
  let inner = cache.get(collection);
  if (!inner) {
    inner = new Map();
    cache.set(collection, inner);
  }
  inner.set(recordId, guard);
}

export function getEntryGuard(collection: string, recordId: string): string | undefined {
  return cache.get(collection)?.get(recordId);
}

export function deleteEntryGuard(collection: string, recordId: string): void {
  cache.get(collection)?.delete(recordId);
}

/**
 * Purge the whole in-memory cache. Must be called on logout (the session
 * is dead; keeping stale guards around is a minor leak). The cache never
 * survives a page reload — no persistence — so this is a pure
 * memory-hygiene call.
 */
export function clearGuardsCache(): void {
  cache.clear();
}
