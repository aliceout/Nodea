import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users — owners of encrypted data.
 *
 * `encryption_salt` and `encrypted_key` form the E2E wrapper: the client
 * derives a KEK from the user password + salt (argon2id), which is used to
 * decrypt `encrypted_key` and obtain the main key. The server never sees
 * the main key.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    /**
     * Public display name. Optional — users can register without setting
     * one. Uniqueness is enforced via a partial unique index so multiple
     * rows with NULL stay allowed.
     */
    username: text('username'),
    passwordHash: text('password_hash').notNull(),
    encryptionSalt: text('encryption_salt').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    onboardingStatus: text('onboarding_status', { enum: ['pending', 'complete'] })
      .notNull()
      .default('pending'),
    onboardingVersion: text('onboarding_version').notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_username_unique')
      .on(t.username)
      .where(sql`${t.username} IS NOT NULL`),
  ],
);

/**
 * Sessions — server-side session records. The cookie carries only the
 * signed session id; rights and TTL live here so that logout / revocation
 * is immediate.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_expires_at_idx').on(t.expiresAt)],
);

/**
 * Invites — single-use registration codes. Stored hashed (never in clear).
 * Consumption is atomic via transaction + `SELECT ... FOR UPDATE`.
 */
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    codeHash: text('code_hash').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invites_code_hash_unique').on(t.codeHash)],
);

/**
 * Factory for per-module entry tables. Every module stores its records
 * with the same shape: an opaque encrypted payload + a HMAC guard
 * computed by the client from its main key + the record id.
 *
 * Using a single factory guarantees structural uniformity across
 * collections — middleware can treat any entry table interchangeably.
 */
function createEntryTable(name: string) {
  return pgTable(
    name,
    {
      id: text('id').primaryKey(),
      userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      /**
       * `module_user_id` is an anonymous per-module sub-identifier chosen
       * by the client. Two modules can never collide because the
       * (user_id, module_user_id) tuple scopes queries, and the sid is
       * derived from module-specific entropy client-side.
       */
      moduleUserId: text('module_user_id').notNull(),
      cipherIv: text('cipher_iv').notNull(),
      payload: text('payload').notNull(),
      /**
       * HMAC guard. `"init"` on creation (client doesn't yet know the
       * record id), then promoted once to `g_<64 hex>` and frozen.
       * Never exposed in read responses.
       */
      guard: text('guard').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [index(`${name}_user_sid_idx`).on(t.userId, t.moduleUserId)],
  );
}

export const moodEntries = createEntryTable('mood_entries');
export const goalsEntries = createEntryTable('goals_entries');
export const passageEntries = createEntryTable('passage_entries');
export const habitsItemsEntries = createEntryTable('habits_items_entries');
export const habitsLogsEntries = createEntryTable('habits_logs_entries');
export const libraryItemsEntries = createEntryTable('library_items_entries');
export const libraryReviewsEntries = createEntryTable('library_reviews_entries');
export const reviewEntries = createEntryTable('review_entries');

/**
 * Shared type alias. All entry tables are structurally identical and can
 * be used interchangeably in generic helpers (middleware, factories).
 */
export type EntryTable = typeof moodEntries;

/**
 * Per-user module configuration (which modules are active, per-module
 * settings). Keyed on user_id (1:1) so `requireUser` is sufficient — no
 * guard validation. This is documented here and in the route handler.
 */
export const modulesConfig = pgTable('modules_config', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cipherIv: text('cipher_iv').notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type EntryRow = typeof moodEntries.$inferSelect;
export type NewEntryRow = typeof moodEntries.$inferInsert;
export type ModulesConfig = typeof modulesConfig.$inferSelect;
