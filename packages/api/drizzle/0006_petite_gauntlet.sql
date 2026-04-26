CREATE TABLE "library_covers_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"module_user_id" text NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"guard" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_covers_entries" ADD CONSTRAINT "library_covers_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_covers_entries_user_sid_idx" ON "library_covers_entries" USING btree ("user_id","module_user_id");