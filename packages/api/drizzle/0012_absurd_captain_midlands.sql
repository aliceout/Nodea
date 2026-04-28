ALTER TABLE "goals_entries" DROP CONSTRAINT "goals_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "habits_items_entries" DROP CONSTRAINT "habits_items_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "habits_logs_entries" DROP CONSTRAINT "habits_logs_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "library_covers_entries" DROP CONSTRAINT "library_covers_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "library_items_entries" DROP CONSTRAINT "library_items_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "library_reviews_entries" DROP CONSTRAINT "library_reviews_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "mood_entries" DROP CONSTRAINT "mood_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "passage_entries" DROP CONSTRAINT "passage_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "review_entries" DROP CONSTRAINT "review_entries_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "goals_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "habits_items_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "habits_logs_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "library_covers_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "library_items_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "library_reviews_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "mood_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "passage_entries_user_sid_idx";--> statement-breakpoint
DROP INDEX "review_entries_user_sid_idx";--> statement-breakpoint
CREATE INDEX "goals_entries_sid_idx" ON "goals_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "habits_items_entries_sid_idx" ON "habits_items_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "habits_logs_entries_sid_idx" ON "habits_logs_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "library_covers_entries_sid_idx" ON "library_covers_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "library_items_entries_sid_idx" ON "library_items_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "library_reviews_entries_sid_idx" ON "library_reviews_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "mood_entries_sid_idx" ON "mood_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "passage_entries_sid_idx" ON "passage_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "review_entries_sid_idx" ON "review_entries" USING btree ("module_user_id");--> statement-breakpoint
ALTER TABLE "goals_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "habits_items_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "habits_logs_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "library_covers_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "library_items_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "library_reviews_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "mood_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "passage_entries" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "review_entries" DROP COLUMN "user_id";