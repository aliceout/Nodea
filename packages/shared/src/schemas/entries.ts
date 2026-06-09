import { z } from 'zod';

/**
 * Body-size caps for the encrypted record envelope. Both `cipherIv`
 * and `payload` cross the wire as base64-encoded strings.
 *
 * - **cipherIv** is the AES-GCM IV — 12 raw bytes = 16 base64 chars.
 *   A 64-char cap is paranoid (4× the theoretical max) and rejects
 *   any client trying to smuggle bytes through the IV field.
 * - **payload** is the encrypted JSON. Real-world ceiling :
 *     · Mood / Goals / Habits entries are ≤ 2-5 KB each ;
 *     · Journal entries with inline image attachments can reach
 *       ~500 KB if multiple photos are bundled ;
 *     · Library covers : the cover-fetch proxy in `library-lookup.ts`
 *       caps the raw response at 5 MB ; base64 inflates that to
 *       ~6.7 MB on the wire when the client re-uploads it as a
 *       `library_covers_entries` record.
 *   An 8 MB cap (≈ 6 MB raw) accommodates the largest realistic
 *   single record while bounding the per-row write so a malicious
 *   or runaway client can't push 100 MB blobs through every PATCH.
 *
 * Without these caps the body size is gated only by Hono's default
 * `bodyLimit` (usually 100 MB) — far too generous for the encrypted-
 * record surface where the legitimate top end sits ~12× lower.
 */
const CIPHER_IV_MAX_CHARS = 64;
const PAYLOAD_MAX_CHARS = 8 * 1024 * 1024;
const Base64ish = z.string().min(1).max(PAYLOAD_MAX_CHARS);
const CipherIvField = z.string().min(1).max(CIPHER_IV_MAX_CHARS);

/** Initial guard value on record creation. */
export const INIT_GUARD = 'init';

/** Promoted guard: "g_" + at least 32 hex chars (HMAC-SHA-256 → 64 chars). */
export const PromotedGuardSchema = z.string().regex(/^g_[a-f0-9]{32,}$/);

/** Any valid guard (init or promoted). */
export const GuardSchema = z.union([z.literal(INIT_GUARD), PromotedGuardSchema]);
export type GuardValue = z.infer<typeof GuardSchema>;

/**
 * Create-entry payload.
 *
 * - `sid` is the anonymous per-module user id (`moduleUserId` on the
 *   EntryView response).
 * - `cipherIv` and `payload` are the AES-GCM wrapping; opaque to the server.
 * - `guard` MUST be `"init"` on creation — the client cannot compute the
 *   stable HMAC guard without the record id, which the server assigns.
 */
export const CreateEntryBodySchema = z.object({
  sid: z.string().min(1).max(128),
  cipherIv: CipherIvField,
  payload: Base64ish,
  guard: z.literal(INIT_GUARD),
});
export type CreateEntryBody = z.infer<typeof CreateEntryBodySchema>;

/**
 * Update payload.
 *
 * Used for both content updates and the one-time guard promotion from
 * `"init"` to `"g_..."`. The server enforces that a promoted guard cannot
 * change afterwards.
 */
export const UpdateEntryBodySchema = z.object({
  cipherIv: CipherIvField.optional(),
  payload: Base64ish.optional(),
  guard: PromotedGuardSchema.optional(),
});
export type UpdateEntryBody = z.infer<typeof UpdateEntryBodySchema>;

/**
 * Public view of an entry — minimum-readable-surface design.
 *
 * `guard` is deliberately absent (it's the shared secret authenticating
 * mutations). Timestamps (`createdAt`, `updatedAt`) are deliberately
 * absent too — they would leak per-row write activity that the
 * operator could correlate across modules to deanonymise users.
 * Whatever timestamps a module needs live inside the encrypted
 * `payload` ; the client orders entries client-side after
 * decryption.
 */
export const EntryViewSchema = z.object({
  id: z.string(),
  moduleUserId: z.string(),
  cipherIv: CipherIvField,
  payload: Base64ish,
});
export type EntryView = z.infer<typeof EntryViewSchema>;

/**
 * Bulk-create envelope (issue #127).
 *
 * Two endpoints address the N-roundtrip cost of imports :
 *   - `POST /records/bulk`           : create up to BULK_MAX_ENTRIES rows
 *                                       in one transaction, all under the
 *                                       same `sid`, all starting with
 *                                       `guard = "init"`.
 *   - `POST /records/promote-guards` : flip up to BULK_MAX_ENTRIES rows
 *                                       from `"init"` to their final
 *                                       HMAC guard in one transaction.
 *
 * The single per-row PATCH path stays available for content updates ;
 * the bulk variants exist specifically to collapse the import flow
 * (was 2 RT × N records, becomes 2 RT total for N ≤ 100).
 *
 * Caps :
 *   - **BULK_MAX_ENTRIES (100)** — per-request row count. Picked
 *     conservatively to keep one transaction bounded ; the client
 *     batches larger imports into multiple bulk requests.
 *   - **BULK_TOTAL_PAYLOAD_MAX (16 MB)** — aggregate sum of all
 *     payload+IV strings. Twice the single-record cap so a single
 *     bulk request can still carry a few Library covers, but tight
 *     enough that a runaway client can't push 800 MB through one
 *     POST.
 */
export const BULK_MAX_ENTRIES = 100;
export const BULK_TOTAL_PAYLOAD_MAX = 16 * 1024 * 1024;

const BulkCreateItemSchema = z.object({
  cipherIv: CipherIvField,
  payload: Base64ish,
});

export const BulkCreateEntryBodySchema = z
  .object({
    sid: z.string().min(1).max(128),
    entries: z.array(BulkCreateItemSchema).min(1).max(BULK_MAX_ENTRIES),
  })
  .superRefine((data, ctx) => {
    let total = 0;
    for (const e of data.entries) total += e.payload.length + e.cipherIv.length;
    if (total > BULK_TOTAL_PAYLOAD_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: 'bulk_payload_too_large',
        path: ['entries'],
      });
    }
  });
export type BulkCreateEntryBody = z.infer<typeof BulkCreateEntryBodySchema>;

export const BulkCreateEntryResponseSchema = z.object({
  data: z.array(EntryViewSchema),
});
export type BulkCreateEntryResponse = z.infer<typeof BulkCreateEntryResponseSchema>;

const BulkPromoteItemSchema = z.object({
  id: z.string().min(1).max(128),
  guard: PromotedGuardSchema,
});

export const BulkPromoteGuardsBodySchema = z.object({
  sid: z.string().min(1).max(128),
  promotions: z.array(BulkPromoteItemSchema).min(1).max(BULK_MAX_ENTRIES),
});
export type BulkPromoteGuardsBody = z.infer<typeof BulkPromoteGuardsBodySchema>;

export const BulkPromoteGuardsResponseSchema = z.object({
  promoted: z.number().int().nonnegative(),
});
export type BulkPromoteGuardsResponse = z.infer<typeof BulkPromoteGuardsResponseSchema>;

/**
 * Wipe-by-sid envelope.
 *
 * Body for `POST /records/wipe` — deletes every row in the
 * targeted collection whose `module_user_id` matches `sid`. The
 * route is gated by `requireFreshPassword` so a stolen session
 * cookie can't trigger the destruction without a fresh password
 * proof in the last 5 minutes. The « Vider toutes les entrées »
 * action in Settings → Modules drives this endpoint, one call per
 * collection the module owns.
 */
export const WipeBySidBodySchema = z.object({
  sid: z.string().min(1).max(128),
});
export type WipeBySidBody = z.infer<typeof WipeBySidBodySchema>;

export const WipeBySidResponseSchema = z.object({
  deleted: z.number().int().nonnegative(),
});
export type WipeBySidResponse = z.infer<typeof WipeBySidResponseSchema>;

/** Modules-config payload — 1:1 on user_id, no guard/sid. The
 *  payload here is a small JSON descriptor of which modules are
 *  enabled / parameterised ; 64 KB is generous. */
export const ModulesConfigBodySchema = z.object({
  cipherIv: CipherIvField,
  payload: z.string().min(1).max(64 * 1024),
});
export type ModulesConfigBody = z.infer<typeof ModulesConfigBodySchema>;

/**
 * Known collection names. Keeping this in shared prevents drift between
 * the API route factory and the web API client.
 */
export const COLLECTION_NAMES = [
  'mood',
  'goals',
  'journal',
  'habits-items',
  'habits-logs',
  'library-items',
  'library-reviews',
  'library-covers',
  'review',
  'hrt-admin-logs',
  'hrt-lab-results',
  'hrt-suppliers',
  'hrt-schedules',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
