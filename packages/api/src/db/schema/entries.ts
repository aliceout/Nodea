import { index, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Factory for per-module entry tables. Every module stores
 * its records with the same shape : an opaque encrypted
 * payload + a HMAC guard computed by the client from its
 * main key + the record id.
 *
 * **Minimum readable surface design (Auth-Spec §2.3).** The
 * only field that conveys « scope » in the clear is
 * `module_user_id` (sid). Every other column is either :
 *   - a server-generated technical handle without user
 *     content (`id` UUID for routing `/records/:id`),
 *   - a crypto byproduct required by the protocol
 *     (`cipher_iv` for AES-GCM decryption),
 *   - opaque ciphertext (`payload`),
 *   - a hidden HMAC checkpoint never returned in reads
 *     (`guard`).
 *
 * No `user_id`, no `created_at`, no `updated_at`. Timestamps
 * would leak per-row write activity (operator could
 * correlate insertions across modules to deanonymise a
 * user). The client puts whatever timestamps it needs inside
 * the encrypted payload — server-side ordering by date no
 * longer exists ; the client orders client-side after
 * decryption.
 *
 * Server-readable user→data linkage is forbidden by design —
 * orphan rows on user removal are accepted as the trade-off.
 *
 * Cascade-on-delete consequences :
 *   - User self-delete is **client-driven** : the client
 *     decrypts `modules_config`, enumerates its sids, and
 *     deletes its entries one by one via the standard
 *     guard-protected DELETE route before the final
 *     `DELETE /auth/me`. Cf. `docs/Architecture.md` §7.4.
 *   - Admin delete (or destructive password reset) leaves
 *     entries orphaned in the entry tables. They become
 *     unreadable (the main key required to decrypt the
 *     payload + recompute the guard is gone). Bounded
 *     growth, accepted by design.
 */
function createEntryTable(name: string) {
  return pgTable(
    name,
    {
      id: text('id').primaryKey(),
      /**
       * `module_user_id` is an anonymous per-module
       * sub-identifier chosen by the client. The user→sid
       * mapping lives encrypted inside
       * `modules_config.payload` ; the server never sees it
       * in plaintext. Two modules can never collide because
       * the sid is derived from module-specific entropy
       * client-side.
       */
      moduleUserId: text('module_user_id').notNull(),
      cipherIv: text('cipher_iv').notNull(),
      payload: text('payload').notNull(),
      /**
       * HMAC guard. `"init"` on creation (client doesn't yet
       * know the record id), then promoted once to
       * `g_<64 hex>` and frozen. Never exposed in read
       * responses.
       */
      guard: text('guard').notNull(),
    },
    (t) => [index(`${name}_sid_idx`).on(t.moduleUserId)],
  );
}

export const moodEntries = createEntryTable('mood_entries');
export const goalsEntries = createEntryTable('goals_entries');
export const journalEntries = createEntryTable('journal_entries');
export const habitsItemsEntries = createEntryTable('habits_items_entries');
export const habitsLogsEntries = createEntryTable('habits_logs_entries');
export const libraryItemsEntries = createEntryTable('library_items_entries');
export const libraryReviewsEntries = createEntryTable('library_reviews_entries');
export const libraryCoversEntries = createEntryTable('library_covers_entries');
export const reviewEntries = createEntryTable('review_entries');
export const hrtAdminLogsEntries = createEntryTable('hrt_admin_logs_entries');
export const hrtLabResultsEntries = createEntryTable('hrt_lab_results_entries');
export const hrtSuppliersEntries = createEntryTable('hrt_suppliers_entries');

/**
 * Shared type alias. All entry tables are structurally
 * identical and can be used interchangeably in generic
 * helpers (middleware, factories).
 */
export type EntryTable = typeof moodEntries;
