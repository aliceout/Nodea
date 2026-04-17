import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, sql } from './db/client.ts';
import { users } from './db/schema.ts';
import { hashPassword } from './auth/password.ts';

/**
 * Seed an initial admin user, idempotent on email.
 *
 * Reads email/password from env vars so the secret never lives in the repo:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @nodea/api seed:admin
 *
 * The admin row gets placeholder `encryption_salt` / `encrypted_key` values —
 * the admin is expected to log in through the web UI and finish the crypto
 * onboarding (which sets the real salt + wrapped main key).
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`[seed] admin ${email} already exists (id=${existing.id}); no-op`);
    await sql.end();
    return;
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email,
    passwordHash,
    encryptionSalt: 'pending-onboarding',
    encryptedKey: 'pending-onboarding',
    role: 'admin',
    onboardingStatus: 'pending',
  });
  console.log(`[seed] admin ${email} created (id=${id})`);
  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await sql.end();
  process.exit(1);
});
