/**
 * Shared seed plumbing.
 *
 * Every per-module seed file (`mood.ts`, `goals.ts`, …) reuses these
 * helpers — the parent orchestrator (`index.ts`) calls
 * `loadSeedContext()` once to drive an in-process OPAQUE login,
 * derive the user's AES + HMAC sub-keys, and hands the result to
 * each module seeder.
 *
 * Crypto: matches `packages/web/src/core/crypto/*` exactly so the
 * encrypted blobs we write here decrypt cleanly in the browser.
 *   - HKDF labels `nodea:aes` / `nodea:hmac` for sub-key splitting.
 *   - AES-GCM-256 with random 12-byte IV.
 *   - Per-record HMAC guard = HMAC(scoped, recordId), prefixed `g_`.
 *
 * Quality > quantity : per-module fixtures are deliberately small
 * (5-10 entries) but hand-written to feel like real journal data —
 * varied tones, real-life detail, no lorem ipsum.
 */

import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import {
  modulesConfig,
  opaqueRecords,
  users,
  type EntryTable,
} from '../db/schema.ts';
import { opaqueLoginUnwrapMainKey } from '../auth/seed-crypto.ts';

const HKDF_LABEL_AES = 'nodea:aes';
const HKDF_LABEL_HMAC = 'nodea:hmac';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedBlob {
  iv: string;
  data: string;
}

export interface SeedContext {
  user: { id: string; email: string };
  aesKey: webcrypto.CryptoKey;
  hmacKey: webcrypto.CryptoKey;
}

export interface SeedResult {
  cleared: number;
  inserted: number;
}

// ---------------------------------------------------------------------
// Bytes ↔ base64 / hex
// ---------------------------------------------------------------------

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

// ---------------------------------------------------------------------
// HKDF + AES + HMAC primitives
// ---------------------------------------------------------------------

async function hkdfDerive(
  ikm: Uint8Array,
  label: string,
  lengthBytes: number,
): Promise<Uint8Array> {
  const ikmKey = await webcrypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ]);
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

async function deriveSubKeys(mainKeyBytes: Uint8Array): Promise<{
  aesKey: webcrypto.CryptoKey;
  hmacKey: webcrypto.CryptoKey;
}> {
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

export async function encryptJson(
  aesKey: webcrypto.CryptoKey,
  value: unknown,
): Promise<EncryptedBlob> {
  const iv = new Uint8Array(randomBytes(12));
  const plain = textEncoder.encode(JSON.stringify(value));
  const ct = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain),
  );
  return { iv: toBase64(iv), data: toBase64(ct) };
}

async function decryptJson<T>(
  aesKey: webcrypto.CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ct = fromBase64(blob.data);
  const plain = new Uint8Array(
    await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct),
  );
  return JSON.parse(textDecoder.decode(plain)) as T;
}

/**
 * Two-pass HMAC matching the web's `deriveGuard`. Output is
 * `g_<64 hex chars>` and matches what the web would compute for
 * the same `(moduleUserId, recordId)` pair.
 */
export async function deriveGuard(
  hmacKey: webcrypto.CryptoKey,
  moduleUserId: string,
  recordId: string,
): Promise<string> {
  const scopedBytes = new Uint8Array(
    await webcrypto.subtle.sign(
      'HMAC',
      hmacKey,
      textEncoder.encode(`guard:${moduleUserId}`),
    ),
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

// ---------------------------------------------------------------------
// modules_config — ensure a per-module sid exists for the seed user
// ---------------------------------------------------------------------

interface ModulesRuntimeMap {
  [moduleId: string]: { enabled: boolean; moduleUserId?: string };
}

/**
 * Pull `modules_config`, decrypt it, ensure the requested module
 * slot is enabled with a `moduleUserId`, re-encrypt and persist if
 * anything changed. Returns the (possibly newly-minted) sid.
 *
 * Module ids match the keys the web's runtime store uses (`mood`,
 * `goals`, `journal`, `library_items`, `library_reviews`,
 * `library_covers`, `review`).
 */
export async function ensureModuleUserId(
  userId: string,
  moduleId: string,
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

  const existing = runtime[moduleId]?.moduleUserId;
  if (existing) return existing;

  const moduleUserId = `m_${bytesToHex(new Uint8Array(randomBytes(16)))}`;
  runtime[moduleId] = { enabled: true, moduleUserId };
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

// ---------------------------------------------------------------------
// Wipe + insert helpers
// ---------------------------------------------------------------------

/**
 * Idempotent module seed — wipes every row matching `moduleUserId`
 * on `table`, then encrypts each cleartext fixture and inserts it
 * with a fresh `(id, guard)` pair. Returns the count of cleared and
 * inserted rows so the orchestrator can log a tidy summary.
 */
export async function replaceEntries<T>(
  table: EntryTable,
  moduleUserId: string,
  fixtures: ReadonlyArray<T>,
  aesKey: webcrypto.CryptoKey,
  hmacKey: webcrypto.CryptoKey,
): Promise<SeedResult> {
  const cleared = await db
    .delete(table)
    .where(eq(table.moduleUserId, moduleUserId))
    .returning({ id: table.id });

  let inserted = 0;
  for (const fixture of fixtures) {
    const blob = await encryptJson(aesKey, fixture);
    const id = randomUUID();
    const guard = await deriveGuard(hmacKey, moduleUserId, id);
    await db.insert(table).values({
      id,
      moduleUserId,
      cipherIv: blob.iv,
      payload: blob.data,
      guard,
    });
    inserted += 1;
  }

  return { cleared: cleared.length, inserted };
}

// ---------------------------------------------------------------------
// Seed context — runs the OPAQUE login round-trip once per seed
// ---------------------------------------------------------------------

/**
 * Drive an in-process OPAQUE login for the configured admin user,
 * unwrap the main key, derive the AES + HMAC sub-keys, and return
 * the materials each module seeder needs.
 *
 * Refuses to run outside dev / test unless the operator opts in
 * via `ALLOW_DESTRUCTIVE_SEED=1` — every module seeder wipes the
 * user's prior data before reseeding, which is the kind of thing
 * that should never happen by accident in production.
 */
export async function loadSeedContext(scriptName: string): Promise<SeedContext> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv === 'development' || nodeEnv === 'test';
  if (!isDev && process.env.ALLOW_DESTRUCTIVE_SEED !== '1') {
    console.error(
      `[${scriptName}] refusing to run with NODE_ENV=${nodeEnv} — this script wipes existing entries before reseeding. Set ALLOW_DESTRUCTIVE_SEED=1 to override (you almost certainly do not want to do that in production).`,
    );
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(`[${scriptName}] ADMIN_EMAIL and ADMIN_PASSWORD must be set`);
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`[${scriptName}] user ${email} not found — run \`seed:admin\` first`);
    process.exit(1);
  }
  if (
    !user.wrappedMainKey ||
    !user.wrappedMainKeyIv ||
    !user.wrappedKekPassword ||
    !user.wrappedKekPasswordIv
  ) {
    console.error(
      `[${scriptName}] user ${email} has no OPAQUE wrap blobs — re-seed via \`seed:admin\` first.`,
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
      `[${scriptName}] user ${email} has no opaque_records row — re-seed via \`seed:admin\` first.`,
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
  const subKeys = await deriveSubKeys(mainKey);
  mainKey.fill(0);

  return {
    user: { id: user.id, email },
    ...subKeys,
  };
}

// ---------------------------------------------------------------------
// Date helpers — every fixture uses these so re-running the seed
// always produces a fresh « today » dataset.
// ---------------------------------------------------------------------

/** ISO date `YYYY-MM-DD` for `n` days before today (local TZ). */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/** ISO date `YYYY-MM-DD` for `n` months before today (local TZ). */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return formatDate(d);
}

/** ISO timestamp `YYYY-MM-DDTHH:mm:ss.sssZ` for `n` days before now. */
export function nowMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
