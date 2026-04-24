CREATE TABLE "goals_entries" (
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
CREATE TABLE "habits_items_entries" (
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
CREATE TABLE "habits_logs_entries" (
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
CREATE TABLE "library_items_entries" (
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
CREATE TABLE "library_reviews_entries" (
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
CREATE TABLE "modules_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"cipher_iv" text NOT NULL,
	"payload" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_entries" (
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
CREATE TABLE "passage_entries" (
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
CREATE TABLE "review_entries" (
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
ALTER TABLE "goals_entries" ADD CONSTRAINT "goals_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits_items_entries" ADD CONSTRAINT "habits_items_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits_logs_entries" ADD CONSTRAINT "habits_logs_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items_entries" ADD CONSTRAINT "library_items_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_reviews_entries" ADD CONSTRAINT "library_reviews_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules_config" ADD CONSTRAINT "modules_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_entries" ADD CONSTRAINT "passage_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_entries" ADD CONSTRAINT "review_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_entries_user_sid_idx" ON "goals_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "habits_items_entries_user_sid_idx" ON "habits_items_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "habits_logs_entries_user_sid_idx" ON "habits_logs_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "library_items_entries_user_sid_idx" ON "library_items_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "library_reviews_entries_user_sid_idx" ON "library_reviews_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "mood_entries_user_sid_idx" ON "mood_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "passage_entries_user_sid_idx" ON "passage_entries" USING btree ("user_id","module_user_id");--> statement-breakpoint
CREATE INDEX "review_entries_user_sid_idx" ON "review_entries" USING btree ("user_id","module_user_id");