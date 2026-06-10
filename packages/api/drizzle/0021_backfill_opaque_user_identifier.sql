-- Backfill `opaque_records.user_identifier` for accounts that
-- pre-date migration 0020 (audit 2026-06 passe 2).
--
-- Migration 0020 added the column but left it NULL on every existing
-- row. Login falls back to `users.email` when the column is NULL —
-- correct ONLY as long as the account never changed its email. But
-- the change-email route never stamped the column either, so a
-- pre-0020 account that changes its email would fall back to the
-- NEW email while its OPAQUE envelope was registered under the OLD
-- one → permanent password-login lockout, the exact bug 0020 meant
-- to fix.
--
-- Backfilling NULL rows with the CURRENT email is correct : any
-- account that can currently log in with a password has, by
-- construction, never changed its email (change-email locked it out
-- before this fix). So current email == registration identifier for
-- every loggable NULL row.
UPDATE "opaque_records" AS o
SET "user_identifier" = u."email"
FROM "users" AS u
WHERE u."id" = o."user_id" AND o."user_identifier" IS NULL;
