import { randomUUID, webcrypto } from 'node:crypto';
import { client, ready } from '@serenity-kit/opaque';
import { eq } from 'drizzle-orm';
import { UsernameField } from '@nodea/shared';
import { db, sql } from './db/client.ts';
import { opaqueRecords, users } from './db/schema.ts';
import { createRegistrationResponse } from './auth/opaque.ts';

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
 * process: client.startRegistration → server.createRegistrationResponse
 * → client.finishRegistration produce the `registrationRecord` we
 * persist in `opaque_records.envelope`, plus the `exportKey` we use
 * to wrap a fresh KEK that itself wraps the random main key. The
 * resulting blobs are byte-compatible with what the web register
 * flow ships, so the seeded admin can sign in immediately via the
 * UI (which is the OPAQUE 2-step from /auth/login/start onwards).
 *
 * The legacy Argon2id columns (`password_hash`, `encryption_salt`,
 * `encrypted_key`) stay NULL — Phase 2D drops them entirely.
 */

const HKDF_LABEL_WRAP_KEK = 'nodea:wrap-kek';
const HKDF_LABEL_WRAP_MAIN = 'nodea:wrap-main';
const textEncoder = new TextEncoder();

function buildKekAAD(userId: string): string {
  return `nodea:v1\x1f${userId}\x1fpassword`;
}
function buildMainKeyAAD(userId: string): string {
  return `nodea:v1\x1f${userId}\x1fmain`;
}

function freshBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  webcrypto.getRandomValues(out);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function deriveAesKey(ikm: Uint8Array, label: string): Promise<CryptoKey> {
  const ikmKey = await webcrypto.subtle.importKey(
    'raw',
    ikm as BufferSource,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const subkey = await webcrypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as BufferSource,
      info: textEncoder.encode(label) as BufferSource,
    },
    ikmKey,
    32 * 8,
  );
  return webcrypto.subtle.importKey(
    'raw',
    subkey,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
}

async function wrapAesGcm(
  plaintext: Uint8Array,
  key: CryptoKey,
  aad: string,
): Promise<{ data: string; iv: string }> {
  const iv = freshBytes(12);
  const ct = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    key,
    plaintext as BufferSource,
  );
  return {
    data: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
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

  if (username) {
    const [existingByUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (existingByUsername) {
      console.log(
        `[seed] username "${username}" is already taken by ${existingByUsername.email} (id=${existingByUsername.id}); no-op`,
      );
      console.log(
        `[seed] tip: align ADMIN_EMAIL with the existing admin, or pick a different ADMIN_USERNAME, or drop that user first`,
      );
      await sql.end();
      return;
    }
  }

  await ready;
  const id = randomUUID();

  // OPAQUE registration handshake — three local calls, no DB writes
  // yet. The lib lets us run client + server in the same process, so
  // we don't need a network round-trip here.
  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password,
  });
  const { registrationResponse } = createRegistrationResponse({
    userIdentifier: email,
    registrationRequest,
  });
  const { registrationRecord, exportKey } = client.finishRegistration({
    password,
    clientRegistrationState,
    registrationResponse,
  });

  // KEK + main key wrapping — same construction as the web's
  // `factor-wrap.ts`. Bytes are zeroed in finally.
  const kek = freshBytes(32);
  const mainKey = freshBytes(32);
  try {
    const mainKeyKey = await deriveAesKey(kek, HKDF_LABEL_WRAP_MAIN);
    const mainKeyWrap = await wrapAesGcm(mainKey, mainKeyKey, buildMainKeyAAD(id));

    const kekKey = await deriveAesKey(
      base64UrlToBytes(exportKey),
      HKDF_LABEL_WRAP_KEK,
    );
    const kekWrap = await wrapAesGcm(kek, kekKey, buildKekAAD(id));

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        email,
        username,
        wrappedMainKey: mainKeyWrap.data,
        wrappedMainKeyIv: mainKeyWrap.iv,
        wrappedKekPassword: kekWrap.data,
        wrappedKekPasswordIv: kekWrap.iv,
        role: 'admin',
        onboardingStatus: 'pending',
        registerState: 'complete',
        // Seeded admins bypass the activation gate — they own the
        // email by construction.
        emailVerifiedAt: new Date(),
      });
      await tx.insert(opaqueRecords).values({
        userId: id,
        envelope: registrationRecord,
      });
    });
  } finally {
    kek.fill(0);
    mainKey.fill(0);
  }

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
