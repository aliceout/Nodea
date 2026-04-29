import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './users.ts';

/**
 * Per-user module configuration (which modules are active,
 * per-module settings). Keyed on user_id (1:1) so
 * `requireUser` is sufficient — no guard validation. This is
 * documented here and in the route handler.
 */
export const modulesConfig = pgTable('modules_config', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cipherIv: text('cipher_iv').notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * User preferences — theme, language, and any other
 * cross-device personalisation. 1:1 on `user_id`, same E2E-
 * encrypted envelope as `modules_config` (no `guard` needed ;
 * the user IS the record). Kept as a separate table so
 * server-side admins can never accidentally read preferences
 * while auditing modules, and vice versa.
 */
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cipherIv: text('cipher_iv').notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
