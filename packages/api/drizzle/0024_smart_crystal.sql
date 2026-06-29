ALTER TABLE "users" ADD COLUMN "recovery_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_verify_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Phase 3B backfill: existing acknowledged codes anchor the re-verify
-- ladder at their ORIGINAL acknowledgement time (streak stays 0 → due 6
-- weeks after that timestamp). So rows acknowledged > 6 weeks ago are due
-- immediately when this lands and self-heal (stamp a fresh anchor) on
-- their first re-verify; recent ones get the rest of their 6-week window.
-- Runs once.
UPDATE "users" SET "recovery_verified_at" = "recovery_acknowledged_at" WHERE "recovery_code_hash" IS NOT NULL;