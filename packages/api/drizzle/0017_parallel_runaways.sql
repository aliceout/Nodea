CREATE TABLE "hrt_admin_logs_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"module_user_id" text NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"guard" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrt_lab_results_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"module_user_id" text NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"guard" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hrt_admin_logs_entries_sid_idx" ON "hrt_admin_logs_entries" USING btree ("module_user_id");--> statement-breakpoint
CREATE INDEX "hrt_lab_results_entries_sid_idx" ON "hrt_lab_results_entries" USING btree ("module_user_id");