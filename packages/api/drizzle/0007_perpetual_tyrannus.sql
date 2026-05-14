CREATE TYPE "public"."auth_factor_kind" AS ENUM('passkey');--> statement-breakpoint
CREATE TYPE "public"."email_verification_kind" AS ENUM('register', 'email_change');--> statement-breakpoint
CREATE TYPE "public"."mfa_factor" AS ENUM('totp', 'passkey');--> statement-breakpoint
CREATE TYPE "public"."register_state" AS ENUM('pre_register', 'email_verified', 'password_set', 'recovery_set', 'complete');--> statement-breakpoint
CREATE TYPE "public"."security_mode" AS ENUM('password_or_passkey', 'always_totp', 'maximum');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('full', 'mfa_pending', 'register', 'migrate');--> statement-breakpoint
CREATE TABLE "auth_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "auth_factor_kind" NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"sign_count_strict" boolean DEFAULT true NOT NULL,
	"transports" text,
	"prf_supported" boolean DEFAULT false NOT NULL,
	"wrapped_kek" text,
	"wrapped_kek_iv" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"kind" "email_verification_kind" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_bypass_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"factor" "mfa_factor" NOT NULL,
	"confirm_token_hash" text NOT NULL,
	"cancel_token_hash" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_totp" (
	"user_id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"algo" text DEFAULT 'SHA1' NOT NULL,
	"digits" integer DEFAULT 6 NOT NULL,
	"period" integer DEFAULT 30 NOT NULL,
	"last_window" bigint,
	"enabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_totp_recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "opaque_records" (
	"user_id" text PRIMARY KEY NOT NULL,
	"envelope" text NOT NULL,
	"server_key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "kind" "session_kind" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "reauth_password_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "reauth_passkey_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_password_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_passkey_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_totp_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pending_webauthn_challenge" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pending_webauthn_challenge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_mode" "security_mode" DEFAULT 'password_or_passkey' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "register_state" "register_state" DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_main_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_main_key_iv" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_kek_password" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_kek_password_iv" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_kek_recovery" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_kek_recovery_iv" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_code_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_factors" ADD CONSTRAINT "auth_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_bypass_requests" ADD CONSTRAINT "mfa_bypass_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_totp" ADD CONSTRAINT "mfa_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_totp_recovery_codes" ADD CONSTRAINT "mfa_totp_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opaque_records" ADD CONSTRAINT "opaque_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_factors_credential_id_unique" ON "auth_factors" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "auth_factors_user_idx" ON "auth_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verifications_email_idx" ON "email_verifications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_bypass_one_active" ON "mfa_bypass_requests" USING btree ("user_id") WHERE cancelled_at IS NULL AND consumed_at IS NULL;--> statement-breakpoint
CREATE INDEX "mfa_totp_recovery_user_idx" ON "mfa_totp_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_kind_idx" ON "sessions" USING btree ("user_id","kind");