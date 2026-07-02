CREATE TABLE "cycle_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"module_user_id" text NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"guard" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cycle_entries_sid_idx" ON "cycle_entries" USING btree ("module_user_id");