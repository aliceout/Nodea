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
  habits: ['habits-items', 'habits-logs'],
  library: ['library-items', 'library-reviews', 'library-covers'],
  review: ['review'],
  hrt: ['hrt-admin-logs', 'hrt-lab-results', 'hrt-suppliers', 'hrt-schedules'],
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
  const payload: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw Object.assign(new Error(`wipe ${collection} -> ${res.status}`), {
      status: res.status,
      payload,
    });
  }
  const body = payload as { deleted?: number } | null;
  return body?.deleted ?? 0;
}

/**
 * Wipe every collection the module owns under the given sid.
 * Returns a summary the UI surfaces as « X entrées supprimées ».
 *
 * Each collection is one network round-trip ; we run them serially
 * because the typical module owns 1-4 collections and parallelism
 * would only buy ~100 ms while making error attribution harder.
 * Aborts on the first failure (typically a 401 reauth_required if
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
    const deleted = await wipeOne(collection, sid);
    perCollection.push({ collection, deleted });
    total += deleted;
  }
  return { deleted: total, perCollection };
}
