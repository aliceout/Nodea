ALTER TABLE "users" ADD COLUMN "recovery_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_verify_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Phase 3B backfill: existing acknowledged codes anchor the re-verify
-- ladder at their original acknowledgement time (streak stays 0 → first
-- re-verify falls due 6 weeks after the column lands). Runs once.
UPDATE "users" SET "recovery_verified_at" = "recovery_acknowledged_at" WHERE "recovery_code_hash" IS NOT NULL;