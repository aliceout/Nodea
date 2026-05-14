CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
-- Wipe legacy invitation-code rows: the new model is email-bound and
-- the schema enforces NOT NULL on `email`, which would otherwise fail
-- on existing rows. No production data here (Phase 1 dev only) so the
-- DELETE is safe. Authored manually post `db:generate` — Drizzle
-- doesn't surface DELETEs in additive migrations.
DELETE FROM "invites";
--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" USING btree ("email");