import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { MoodPayloadSchema } from '@nodea/shared';
import { db, sql } from './db/client.ts';
import { users, modulesConfig, moodEntries, opaqueRecords } from './db/schema.ts';
import { opaqueLoginUnwrapMainKey } from './auth/seed-crypto.ts';
import { buildMoodFixtures } from './seed-mood.fixtures.ts';

/**
 * Seed Mood entries for the configured admin user.
 *
 * Idempotent: every run wipes the user's existing `mood_entries`
 * rows before re-inserting the fixtures, so the seed can be re-run
 * safely without piling duplicates.
 *
 * Crypto: Phase 2D onwards the unwrap path uses `opaqueLoginUnwrapMainKey`
 * (`auth/seed-crypto.ts`) — runs an in-process OPAQUE login round-trip
 * to derive `exportKey`, then unwraps the KEK and the main key. The
 * resulting bytes go through the same HKDF split (`nodea:aes` /
 * `nodea:hmac`) the web does, so the per-record AES-GCM blobs are
 * decryptable in the browser.
 *
 * Usage:
 *   ADMIN_EMAIL / ADMIN_PASSWORD set as env vars.
 *   pnpm --filter @nodea/api seed:mood
 */

// Must match packages/web/src/core/crypto/hkdf.ts.
const HKDF_LABEL_AES = 'nodea:aes';
const HKDF_LABEL_HMAC = 'nodea:hmac';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

async function hkdfDerive(ikm: Uint8Array, label: string, lengthBytes: number): Promise<Uint8Array> {
  const ikmKey = await webcrypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const derived = await webcrypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: textEncoder.encode(label),
    },
    ikmKey,
    lengthBytes * 8,
  );
  return new Uint8Array(derived);
}

interface SubKeys {
  aesKey: webcrypto.CryptoKey;
  hmacKey: webcrypto.CryptoKey;
}

async function deriveSubKeys(mainKeyBytes: Uint8Array): Promise<SubKeys> {
  const aesBytes = await hkdfDerive(mainKeyBytes, HKDF_LABEL_AES, 32);
  const hmacBytes = await hkdfDerive(mainKeyBytes, HKDF_LABEL_HMAC, 32);
  const aesKey = await webcrypto.subtle.importKey(
    'raw',
    aesBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  const hmacKey = await webcrypto.subtle.importKey(
    'raw',
    hmacBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  aesBytes.fill(0);
  hmacBytes.fill(0);
  return { aesKey, hmacKey };
}

interface EncryptedBlob {
  iv: string;
  data: string;
}

async function encryptJson(aesKey: webcrypto.CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = new Uint8Array(randomBytes(12));
  const plain = textEncoder.encode(JSON.stringify(value));
  const ct = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain),
  );
  return { iv: toBase64(iv), data: toBase64(ct) };
}

async function decryptJson<T>(aesKey: webcrypto.CryptoKey, blob: EncryptedBlob): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ct = fromBase64(blob.data);
  const plain = new Uint8Array(
    await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct),
  );
  return JSON.parse(textDecoder.decode(plain)) as T;
}

/**
 * Same two-pass HMAC the web's `deriveGuard` performs. Output is
 * `g_<64 hex chars>` and matches what the web would compute for
 * the same `(moduleUserId, recordId)` pair.
 */
async function deriveGuard(
  hmacKey: webcrypto.CryptoKey,
  moduleUserId: string,
  recordId: string,
): Promise<string> {
  const scopedBytes = new Uint8Array(
    await webcrypto.subtle.sign('HMAC', hmacKey, textEncoder.encode(`guard:${moduleUserId}`)),
  );
  const scopedKey = await webcrypto.subtle.importKey(
    'raw',
    scopedBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const tag = new Uint8Array(
    await webcrypto.subtle.sign('HMAC', scopedKey, textEncoder.encode(recordId)),
  );
  scopedBytes.fill(0);
  return `g_${bytesToHex(tag)}`;
}

interface ModulesRuntimeMap {
  [moduleId: string]: { enabled: boolean; moduleUserId?: string };
}

/**
 * Look up the user's `modules_config`; decrypt it; ensure the
 * `mood` slot is enabled with a `moduleUserId`; re-encrypt and
 * persist if anything changed. Returns the (possibly newly-minted)
 * mood `moduleUserId`.
 */
async function ensureMoodModuleUserId(
  userId: string,
  aesKey: webcrypto.CryptoKey,
): Promise<string> {
  const [row] = await db
    .select()
    .from(modulesConfig)
    .where(eq(modulesConfig.userId, userId))
    .limit(1);

  let runtime: ModulesRuntimeMap = {};
  if (row) {
    runtime = await decryptJson<ModulesRuntimeMap>(aesKey, {
      iv: row.cipherIv,
      data: row.payload,
    });
  }

  const existing = runtime['mood']?.moduleUserId;
  if (existing) return existing;

  const moduleUserId = `m_${bytesToHex(new Uint8Array(randomBytes(16)))}`;
  runtime['mood'] = { enabled: true, moduleUserId };
  const blob = await encryptJson(aesKey, runtime);

  if (row) {
    await db
      .update(modulesConfig)
      .set({ cipherIv: blob.iv, payload: blob.data, updatedAt: new Date() })
      .where(eq(modulesConfig.userId, userId));
  } else {
    await db.insert(modulesConfig).values({
      userId,
      cipherIv: blob.iv,
      payload: blob.data,
    });
  }
  return moduleUserId;
}

async function main(): Promise<void> {
  // Dev-only — this seed wipes the user's existing mood entries
  // before reseeding, so the safety bar is high. Refuse in any
  // non-dev/test environment unless the operator explicitly opts
  // in via `ALLOW_DESTRUCTIVE_SEED=1`.
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv === 'development' || nodeEnv === 'test';
  if (!isDev && process.env.ALLOW_DESTRUCTIVE_SEED !== '1') {
    console.error(
      `[seed:mood] refusing to run with NODE_ENV=${nodeEnv} — this script wipes existing mood entries before reseeding. Set ALLOW_DESTRUCTIVE_SEED=1 to override (you almost certainly do not want to do that in production).`,
    );
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('[seed:mood] ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`[seed:mood] user ${email} not found — run \`seed:admin\` first`);
    process.exit(1);
  }
  if (
    !user.wrappedMainKey ||
    !user.wrappedMainKeyIv ||
    !user.wrappedKekPassword ||
    !user.wrappedKekPasswordIv
  ) {
    console.error(
      `[seed:mood] user ${email} has no OPAQUE wrap blobs on its row — re-seed via \`seed:admin\` first.`,
    );
    process.exit(1);
  }

  const [record] = await db
    .select({ envelope: opaqueRecords.envelope })
    .from(opaqueRecords)
    .where(eq(opaqueRecords.userId, user.id))
    .limit(1);
  if (!record) {
    console.error(
      `[seed:mood] user ${email} has no opaque_records row — re-seed via \`seed:admin\` first.`,
    );
    process.exit(1);
  }

  const mainKey = await opaqueLoginUnwrapMainKey({
    userId: user.id,
    email,
    password,
    envelope: record.envelope,
    wrappedMainKey: user.wrappedMainKey,
    wrappedMainKeyIv: user.wrappedMainKeyIv,
    wrappedKekPassword: user.wrappedKekPassword,
    wrappedKekPasswordIv: user.wrappedKekPasswordIv,
  });
  const { aesKey, hmacKey } = await deriveSubKeys(mainKey);
  mainKey.fill(0);

  const moduleUserId = await ensureMoodModuleUserId(user.id, aesKey);
  console.log(`[seed:mood] mood moduleUserId for ${email} = ${moduleUserId}`);

  // Wipe existing entries for this user's mood sid so the seed is
  // reproducible — re-running gives a clean dataset, not piled
  // duplicates. Scoped by `moduleUserId` since entry rows no longer
  // carry `user_id`.
  const cleared = await db
    .delete(moodEntries)
    .where(eq(moodEntries.moduleUserId, moduleUserId))
    .returning({ id: moodEntries.id });
  if (cleared.length > 0) {
    console.log(`[seed:mood] cleared ${cleared.length} previous mood entries`);
  }

  const fixtures = buildMoodFixtures();
  let inserted = 0;
  for (const fixture of fixtures) {
    const parsed = MoodPayloadSchema.parse(fixture);
    const blob = await encryptJson(aesKey, parsed);
    const id = randomUUID();
    const guard = await deriveGuard(hmacKey, moduleUserId, id);
    await db.insert(moodEntries).values({
      id,
      moduleUserId,
      cipherIv: blob.iv,
      payload: blob.data,
      guard,
    });
    inserted += 1;
  }
  console.log(`[seed:mood] inserted ${inserted} mood entries for ${email}`);
  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed:mood] failed', err);
  await sql.end();
  process.exit(1);
});
