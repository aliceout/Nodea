ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "encryption_salt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "encrypted_key";