import { randomUUID, webcrypto } from 'node:crypto';
import { client, ready } from '@serenity-kit/opaque';
import { db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import { createInvite } from '../auth/invites.ts';
import { createRegistrationResponse } from '../auth/opaque.ts';
import { hashPassword } from '../auth/password.ts';

export const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-42';
export const ADMIN_PASSWORD = 'Admin-Horse-Battery-Staple-42';

/* ============================================================================
 * OPAQUE seeding — runs the real handshake in-process so seeded users
 * can actually log in via /auth/login/start + /finish (Phase 2C).
 *
 * No reuse of the shared `factor-wrap.ts` from `packages/web/` — it
 * lives in the web package and a cross-package import would split
 * the WASM/WebCrypto initialisation. We re-implement the same
 * primitives inline against Node's `crypto.subtle`; the labels and
 * AAD format match `factor-wrap.ts` byte-for-byte so the resulting
 * envelope unwraps cleanly client-side.
 * ========================================================================== */

const HKDF_LABEL_WRAP_KEK = 'nodea:wrap-kek';
const HKDF_LABEL_WRAP_MAIN = 'nodea:wrap-main';
const textEncoder = new TextEncoder();

function buildKekAAD(userId: string, tag: 'password' | 'passkey' | 'recovery'): string {
  return `nodea:v1\x1f${userId}\x1f${tag}`;
}
function buildMainKeyAAD(userId: string): string {
  return `nodea:v1\x1f${userId}\x1fmain`;
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = (b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

async function deriveAesKey(ikm: Uint8Array, label: string): Promise<CryptoKey> {
  const ikmKey = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  const subkey = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as BufferSource,
      info: textEncoder.encode(label) as BufferSource,
    },
    ikmKey,
    32 * 8,
  );
  return crypto.subtle.importKey('raw', subkey, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
}

function freshBytes(length: number): Uint8Array {
  // Use the WebCrypto getRandomValues so the underlying buffer is a
  // plain `ArrayBuffer` (not `SharedArrayBuffer`) and lines up with
  // `crypto.subtle`'s `BufferSource` parameter type. Node's
  // `crypto.randomBytes` returns a Buffer, which TypeScript narrows
  // to an incompatible variant under `lib.dom.d.ts`'s WebCrypto types.
  const out = new Uint8Array(length);
  webcrypto.getRandomValues(out);
  return out;
}

async function wrapAesGcm(
  plaintext: Uint8Array,
  key: CryptoKey,
  aad: string,
): Promise<{ data: string; iv: string }> {
  const iv = freshBytes(12);
  const ct = await crypto.subtle.encrypt(
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

interface SeedOpts {
  role?: 'user' | 'admin';
  password: string;
  username?: string;
}

async function seedOpaqueUser(
  email: string,
  opts: SeedOpts,
): Promise<{ id: string; email: string }> {
  await ready;
  const id = randomUUID();
  const userIdentifier = email.toLowerCase();

  // OPAQUE handshake — three local calls, no DB writes yet.
  const { clientRegistrationState, registrationRequest } =
    client.startRegistration({ password: opts.password });
  const { registrationResponse } = createRegistrationResponse({
    userIdentifier,
    registrationRequest,
  });
  const { registrationRecord, exportKey } = client.finishRegistration({
    password: opts.password,
    clientRegistrationState,
    registrationResponse,
  });

  // KEK + main key wrapping — same construction as
  // `packages/web/src/core/crypto/factor-wrap.ts`.
  const kek = freshBytes(32);
  const mainKey = freshBytes(32);
  try {
    const mainKeyKey = await deriveAesKey(kek, HKDF_LABEL_WRAP_MAIN);
    const mainKeyWrap = await wrapAesGcm(mainKey, mainKeyKey, buildMainKeyAAD(id));

    const kekKey = await deriveAesKey(
      base64UrlToBytes(exportKey),
      HKDF_LABEL_WRAP_KEK,
    );
    const kekWrap = await wrapAesGcm(kek, kekKey, buildKekAAD(id, 'password'));

    // Populate the legacy fields too: change-password / change-email /
    // delete-self routes still consume them in Phase 2C (those flows
    // get rewired to OPAQUE in 2D). Without this the legacy
    // verifyPassword path returns 401 for every seeded test user and
    // those routes' tests would all fail. Once 2D rewires them, this
    // block goes away (along with the legacy columns).
    const legacyHash = await hashPassword(opts.password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        email: userIdentifier,
        username: opts.username ?? null,
        role: opts.role ?? 'user',
        passwordHash: legacyHash,
        encryptionSalt: 'test-salt',
        encryptedKey: 'test-wrapped-key',
        wrappedMainKey: mainKeyWrap.data,
        wrappedMainKeyIv: mainKeyWrap.iv,
        wrappedKekPassword: kekWrap.data,
        wrappedKekPasswordIv: kekWrap.iv,
        emailVerifiedAt: new Date(),
        registerState: 'complete',
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

  return { id, email };
}

export async function seedAdmin(
  email = 'admin@example.com',
): Promise<{ id: string; email: string }> {
  return seedOpaqueUser(email, {
    role: 'admin',
    password: ADMIN_PASSWORD,
  });
}

export async function seedUser(
  email: string,
): Promise<{ id: string; email: string }> {
  return seedOpaqueUser(email, {
    role: 'user',
    password: TEST_PASSWORD,
  });
}

export async function seedInvite(
  email = 'invitee@example.com',
): Promise<{ id: string; token: string; email: string }> {
  const result = await createInvite({ email });
  return { id: result.id, token: result.token, email: result.email };
}

/* ============================================================================
 * OPAQUE login helper — drives /auth/login/start + /finish through the
 * Hono test app and returns the session cookie. Replaces every
 * test's inline `loginAs` from the legacy Argon2id era.
 * ========================================================================== */

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * The Hono test app's request signature. We accept the loosest type
 * here (anything with a `request` method that returns a Response)
 * because the actual app instance carries env Variables that don't
 * line up with a bare `Hono` import — re-typing them at every call
 * site would be churn.
 */
interface RequestableApp {
  request(input: string, init?: RequestInit): Response | Promise<Response>;
}

export async function loginAs(
  app: RequestableApp,
  email: string,
  password: string,
): Promise<string> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) {
    throw new Error(
      `loginAs: /auth/login/start failed (${startRes.status}: ${await startRes.text()})`,
    );
  }
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };

  const finished = client.finishLogin({
    password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('loginAs: client.finishLogin returned undefined (wrong password?)');
  }

  const finishRes = await app.request(
    '/auth/login/finish',
    jsonPost({ loginToken, finishLoginRequest: finished.finishLoginRequest }),
  );
  if (finishRes.status !== 200) {
    throw new Error(
      `loginAs: /auth/login/finish failed (${finishRes.status}: ${await finishRes.text()})`,
    );
  }

  const cookie = extractCookie(finishRes);
  if (!cookie) {
    throw new Error('loginAs: /auth/login/finish returned 200 but no session cookie');
  }
  return cookie;
}

/** Extract the session cookie from a Set-Cookie header, for chaining requests. */
export function extractCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_session=([^;]+)/);
  return match ? `nodea_session=${match[1]}` : null;
}
