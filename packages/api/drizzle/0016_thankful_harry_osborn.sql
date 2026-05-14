-- Rename security_mode enum value `always_totp` → `always_2fa`.
--
-- Drizzle's auto-generated diff DROP-then-CREATE the enum, which
-- breaks any existing row holding `'always_totp'` (the recreated
-- type doesn't include that value, the `USING` cast errors out).
-- Hand-authored migration that preserves rows by going through a
-- text intermediate + UPDATE.
--
-- Issue #72 — pure rename, no behaviour change. Mode `always_2fa`
-- still requires TOTP exclusively until the next commit widens the
-- 2nd-factor accept set to also include non-PRF passkeys.

-- Step 1 : drop the column default so we can change the type freely.
ALTER TABLE "users" ALTER COLUMN "security_mode" DROP DEFAULT;

-- Step 2 : convert the column to text so the enum can be replaced.
ALTER TABLE "users" ALTER COLUMN "security_mode" SET DATA TYPE text;

-- Step 3 : rewrite every legacy `always_totp` row to the new name.
-- Non-destructive : the user's effective security policy is preserved
-- (still requires the same 2nd factor — TOTP — until the behaviour
-- change commit lands).
UPDATE "users" SET "security_mode" = 'always_2fa' WHERE "security_mode" = 'always_totp';

-- Step 4 : drop the old enum type and recreate with the new value set.
DROP TYPE "public"."security_mode";
CREATE TYPE "public"."security_mode" AS ENUM('password_or_passkey', 'always_2fa', 'maximum');

-- Step 5 : restore the default + re-cast the column to the new enum.
ALTER TABLE "users" ALTER COLUMN "security_mode" SET DEFAULT 'password_or_passkey'::"public"."security_mode";
ALTER TABLE "users" ALTER COLUMN "security_mode" SET DATA TYPE "public"."security_mode" USING "security_mode"::"public"."security_mode";
