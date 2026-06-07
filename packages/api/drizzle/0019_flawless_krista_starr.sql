CREATE TABLE "hrt_schedules_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"module_user_id" text NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"guard" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hrt_schedules_entries_sid_idx" ON "hrt_schedules_entries" USING btree ("module_user_id");