import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { hashRaw } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { UsernameField } from '@nodea/shared';
import { db, sql } from './db/client.ts';
import { users } from './db/schema.ts';
import { hashPassword } from './auth/password.ts';

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
 * Unlike a normal register flow, the seed has no browser to generate
 * the encryption envelope — so we reproduce the exact same wrap the
 * web does (argon2id-derived KEK → AES-GCM-wrapped random main key),
 * using `@node-rs/argon2` and Node's WebCrypto. The resulting
 * `encryption_salt` / `encrypted_key` are interoperable with the web
 * crypto (same parameters) so the admin can log in immediately
 * through the UI.
 */

// Must match packages/web/src/core/crypto/argon2.ts
const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY_KB = 64 * 1024;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LEN = 32;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

async function wrapMainKey(
  password: string,
  mainKeyBytes: Uint8Array,
): Promise<{ encryptionSalt: string; encryptedKey: string }> {
  const saltBytes = new Uint8Array(randomBytes(16));

  // `algorithm` defaults to Argon2id in @node-rs/argon2 — no need to
  // pass the const-enum value (which TS refuses under
  // verbatimModuleSyntax).
  const kek = await hashRaw(password, {
    salt: saltBytes,
    timeCost: ARGON2_ITERATIONS,
    memoryCost: ARGON2_MEMORY_KB,
    parallelism: ARGON2_PARALLELISM,
    outputLen: ARGON2_HASH_LEN,
  });

  const aesKey = await webcrypto.subtle.importKey(
    'raw',
    kek,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  // The web encrypts the base64 text of the main-key bytes (not the
  // raw bytes), so the on-the-wire envelope matches what `wrapMainKey`
  // in `packages/web/src/core/crypto/envelope.ts` produces.
  const payloadText = toBase64(mainKeyBytes);
  const iv = new Uint8Array(randomBytes(12));
  const ciphertext = new Uint8Array(
    await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(payloadText),
    ),
  );

  kek.fill(0);

  return {
    encryptionSalt: toBase64(saltBytes),
    encryptedKey: `${toBase64(iv)}.${toBase64(ciphertext)}`,
  };
}

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

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`[seed] admin ${email} already exists (id=${existing.id}); no-op`);
    await sql.end();
    return;
  }

  // Generate a fresh random main key and wrap it under the password.
  // The raw bytes are zeroed immediately after the wrap.
  const rawMainKey = new Uint8Array(randomBytes(32));
  const { encryptionSalt, encryptedKey } = await wrapMainKey(password, rawMainKey);
  rawMainKey.fill(0);

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email,
    username,
    passwordHash,
    encryptionSalt,
    encryptedKey,
    role: 'admin',
    onboardingStatus: 'pending',
  });
  console.log(
    `[seed] admin ${email} created (id=${id}${username ? `, username=${username}` : ''})`,
  );
  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await sql.end();
  process.exit(1);
});
