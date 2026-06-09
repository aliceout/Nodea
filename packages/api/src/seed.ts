import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { UsernameField } from '@nodea/shared';
import { db, sql } from './db/client.ts';
import { opaqueRecords, users } from './db/schema.ts';
import { opaqueRegister } from './auth/seed-crypto.ts';

/**
 * Seed an initial admin user, idempotent on email.
 *
 * Reads credentials from env vars so the secret never lives in the
 * repo. With Infisical (recommended for this repo):
 *   infisical run -- pnpm --filter @nodea/api seed:admin
 *
 * Or fall back to a local `.env` (git-ignored) for offline setups —
 * `tsx --env-file-if-exists=.env` loads it automatically.
 *
 * Phase 2C onwards the seed runs the full OPAQUE registration in
 * process via `opaqueRegister` (`auth/seed-crypto.ts`): client +
 * server OPAQUE handshake → `registrationRecord` for
 * `opaque_records.envelope` plus the standard 2-layer wrap (random
 * KEK over random main key, KEK under HKDF sub-key of `exportKey`).
 * The resulting blobs are byte-compatible with what the web register
 * flow ships, so the seeded admin can sign in immediately via the
 * UI's OPAQUE 2-step from `/auth/login/start` onwards.
 */

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const rawUsername = process.env.ADMIN_USERNAME?.trim();
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }
  if (!process.env.OPAQUE_SERVER_SETUP) {
    console.error(
      'OPAQUE_SERVER_SETUP must be set — generate one and put it in `.env` (or Infisical → api/).',
    );
    process.exit(1);
  }

  // Validate the username against the same schema the HTTP API enforces,
  // so a seeded admin can later rename itself without hitting the 400
  // that would fire on a malformed legacy value.
  let username: string | null = null;
  if (rawUsername) {
    const parsed = UsernameField.safeParse(rawUsername);
    if (!parsed.success) {
      console.error(
        'ADMIN_USERNAME is invalid — must be 2-32 chars of letters, digits, _, ., or -',
      );
      process.exit(1);
    }
    username = parsed.data;
  }

  const [existingByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingByEmail) {
    console.log(`[seed] admin ${email} already exists (id=${existingByEmail.id}); no-op`);
    await sql.end();
    return;
  }

  const id = randomUUID();
  const opaque = await opaqueRegister({ userId: id, email, password });

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email,
      username,
      wrappedMainKey: opaque.wrappedMainKey,
      wrappedMainKeyIv: opaque.wrappedMainKeyIv,
      wrappedKekPassword: opaque.wrappedKekPassword,
      wrappedKekPasswordIv: opaque.wrappedKekPasswordIv,
      role: 'admin',
      onboardingStatus: 'pending',
      registerState: 'complete',
      // Seeded admins bypass the activation gate — they own the
      // email by construction.
      emailVerifiedAt: new Date(),
    });
    await tx.insert(opaqueRecords).values({
      userId: id,
      envelope: opaque.registrationRecord,
      userIdentifier: email,
    });
  });

  console.log(
    `[seed] admin ${email} created (id=${id}${username ? `, username=${username}` : ''}, OPAQUE)`,
  );
  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await sql.end();
  process.exit(1);
});
