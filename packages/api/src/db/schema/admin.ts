/**
 * Admin / instance tables (Drizzle DDL, re-exported by `db/schema.ts`):
 * `invites` (email-bound, token stored hashed in `code_hash`),
 * `app_settings` (key/value — e.g. `open_registration`), `announcements`.
 *
 * Where: api db layer. `invites.created_by`/`used_by`,
 * `app_settings.updated_by` and `announcements.created_by` are FK ON DELETE
 * SET NULL (an admin can be deleted without losing the rows). Per-table
 * details are documented on each export below.
 */
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { users } from './users.ts';

/**
 * Invites — email-bound registration tokens (Bitwarden-style).
 *
 * Admin enters an email, server generates a 32-byte random
 * token, stores its SHA-256 in `code_hash` (column kept for
 * migration brevity, semantic is now « token hash »), and
 * emails the recipient a link of the form
 * `/register?invite=<token>`. The recipient lands on the
 * register page with their email pre-filled and locked —
 * submission is rejected if the email in the form doesn't
 * match the email this invite was issued for.
 *
 * Replaces the previous « invitation code » model where a
 * clear code was generated, displayed in /admin, and pasted
 * by the user into the register form. The new model removes
 * the copy-paste step and gates registration on email
 * control proven via the link click.
 */
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    /** Recipient address — locked at issue time. Strict
     *  match at consumption : the user must sign up with
     *  EXACTLY this email. */
    email: text('email').notNull(),
    /** SHA-256 of the random token put in the activation
     *  link. The column name `code_hash` is preserved for
     *  schema brevity even though the semantic shifted from
     *  « code hash » to « token hash ». */
    codeHash: text('code_hash').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invites_code_hash_unique').on(t.codeHash),
    // Lookups by email when admin asks « is there a pending
    // invite for foo@bar.com » or when register validates
    // the strict match.
    index('invites_email_idx').on(t.email),
  ],
);

/**
 * Application-wide settings keyed/value table.
 *
 * V1 only stores `open_registration: 'true' | 'false'`
 * (default 'false' if absent — defensive : an admin must opt
 * in). Future settings (TOTP requirement, public
 * announcements toggle, etc.) land here too without a schema
 * change.
 *
 * Values are stored as text. Boolean settings parse 'true' /
 * 'false' ; future structured settings can JSON-encode and
 * parse on read.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

/**
 * Announcements — server-side public feed curated by admins.
 * Content is not E2E encrypted : the whole point is to be
 * readable by every logged-in user without needing their
 * main key. `created_by` is kept as an audit trail ;
 * `active` toggles visibility without deleting the row ;
 * `startAt` / `endAt` carry optional scheduling windows.
 */
export const announcements = pgTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    active: boolean('active').notNull().default(true),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('announcements_active_idx').on(t.active, t.createdAt)],
);
