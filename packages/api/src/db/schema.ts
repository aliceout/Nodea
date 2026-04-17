import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
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
 *
 * `used_by` + `used_at` keep an audit trail after consumption; the row is
 * kept (not deleted) so admins can see who redeemed what. A non-null
 * `used_by` means the invite cannot be redeemed again.
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
