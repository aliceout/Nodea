ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "encryption_salt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "encrypted_key" DROP NOT NULL;