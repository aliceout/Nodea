/**
 * Module wipe — one POST per collection the module owns, fanning
 * out to `POST /records/wipe` which deletes every row whose
 * `module_user_id` matches the sid.
 *
 * Wiring :
 *   1. The user opens « Vider » in Settings → Modules.
 *   2. The UI calls `freshenPasswordReauth(password)` to stamp the
 *      session's `reauth_password_at` — without that, the
 *      `requireFreshPassword` middleware on the wipe route rejects
 *      with 401.
 *   3. The UI calls `wipeModule(moduleId, sid)` ; this file looks
 *      up the collections the module owns and POSTs `/records/wipe`
 *      once per collection.
 *
 * Re-auth posture : we deliberately do NOT bundle the password
 * proof into this helper. Re-auth is a separate concern that the UI
 * arranges before invoking the wipe — same pattern as
 * `ExportPanel`'s plaintext export gate (cf. v2.8.0 audit). Keeps
 * the helper composable and avoids dragging an OPAQUE round-trip
 * into a function that's morally a network call.
 *
 * Why not piggy-back on `CollectionClient.remove` : the wipe doesn't
 * need a guard, doesn't need a payload schema, and the server takes
 * one transaction per collection regardless of row count. Building
 * the call from scratch keeps `collection-client.ts` focused on the
 * per-record CRUD a typed schema cares about.
 */
import type { CollectionName } from '@nodea/shared';

/**
 * For each module that owns one or more encrypted collections,
 * the list of collection names that share the module's
 * `moduleUserId` (sid). Modules without an encrypted collection
 * (`home`, `account`, `admin`) are absent on purpose — the
 * « Vider » action is hidden for them at the UI layer.
 */
export const MODULE_COLLECTIONS: Record<string, ReadonlyArray<CollectionName>> = {
  mood: ['mood'],
  journal: ['journal'],
  goals: ['goals'],
  library: ['library-items', 'library-reviews', 'library-covers'],
  review: ['review'],
  hrt: ['hrt-admin-logs', 'hrt-lab-results', 'hrt-suppliers', 'hrt-schedules'],
  cycle: ['cycle'],
};

export interface WipeResult {
  /** Total rows the server reports as deleted across every
   *  collection the module owns. */
  deleted: number;
  /** Per-collection breakdown for the post-wipe summary. */
  perCollection: Array<{ collection: CollectionName; deleted: number }>;
}

function apiBase(): string {
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api'
  );
}

/** POST a single `/records/wipe` call. Throws on a non-2xx
 *  response so the caller can surface the reauth/auth failure
 *  cleanly. The 401 `reauth_required` body shape is preserved on
 *  the thrown error for the UI to detect. */
async function wipeOne(
  collection: CollectionName,
  sid: string,
): Promise<number> {
  const res = await fetch(`${apiBase()}/records/wipe`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-collection': collection,
    },
    body: JSON.stringify({ sid }),
  });
  const text = await res.text();
  // A proxy error page (502/504 HTML) is not JSON — don't let the
  // SyntaxError mask the actual HTTP status (audit 2026-06).
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    throw Object.assign(new Error(`wipe ${collection} -> ${res.status}`), {
      status: res.status,
      payload,
    });
  }
  const body = payload as { deleted?: number } | null;
  return body?.deleted ?? 0;
}

/** Error thrown on a mid-list failure : carries what *was* wiped
 *  before the failing collection so the UI can report precisely
 *  which data is gone instead of a bare error (audit 2026-06). */
export class PartialWipeError extends Error {
  constructor(
    message: string,
    /** Collections successfully wiped before the failure. */
    readonly partial: WipeResult['perCollection'],
    /** Collection the failure happened on. */
    readonly failedCollection: CollectionName,
    /** Underlying error (preserves `status` for reauth detection). */
    override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'PartialWipeError';
  }
}

/** Remove the module's local draft slot, if any. A wipe presented
 *  as « toutes les entrées sont supprimées » must not resurrect a
 *  draft built from the wiped data at the next form open (audit
 *  2026-06). Prefix match covers per-year Review slots. */
function purgeModuleDrafts(moduleId: string): void {
  if (typeof localStorage === 'undefined') return;
  const prefix = `nodea:${moduleId}:draft`;
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) doomed.push(key);
  }
  for (const key of doomed) localStorage.removeItem(key);
}

/**
 * Wipe every collection the module owns under the given sid.
 * Returns a summary the UI surfaces as « X entrées supprimées ».
 *
 * Each collection is one network round-trip ; we run them serially
 * because the typical module owns 1-4 collections and parallelism
 * would only buy ~100 ms while making error attribution harder.
 * A mid-list failure throws `PartialWipeError` carrying the
 * already-wiped collections (typically a 401 reauth_required if
 * the freshness window lapsed mid-flight).
 */
export async function wipeModule(
  moduleId: string,
  sid: string,
): Promise<WipeResult> {
  const collections = MODULE_COLLECTIONS[moduleId];
  if (!collections || collections.length === 0) {
    throw new Error(`wipeModule: unknown module ${moduleId}`);
  }
  const perCollection: WipeResult['perCollection'] = [];
  let total = 0;
  for (const collection of collections) {
    let deleted: number;
    try {
      deleted = await wipeOne(collection, sid);
    } catch (err) {
      throw new PartialWipeError(
        `wipe ${moduleId} failed on ${collection}`,
        perCollection,
        collection,
        err,
      );
    }
    perCollection.push({ collection, deleted });
    total += deleted;
  }
  purgeModuleDrafts(moduleId);
  return { deleted: total, perCollection };
}
