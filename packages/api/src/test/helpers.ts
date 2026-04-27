import { randomUUID } from 'node:crypto';
import { client, ready } from '@serenity-kit/opaque';
import { db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import { createInvite } from '../auth/invites.ts';
import { opaqueRegister } from '../auth/seed-crypto.ts';

export const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-42';
export const ADMIN_PASSWORD = 'Admin-Horse-Battery-Staple-42';

/* ============================================================================
 * OPAQUE-aware seeding — runs the real handshake in process so seeded
 * users can actually log in via /auth/login/start + /finish (Phase 2C+).
 *
 * Phase 2D dropped the legacy Argon2id columns entirely, so seeded
 * users are OPAQUE-only. Tests for change-password / change-email /
 * delete-self exercise the OPAQUE proof path via `loginAs` + the
 * new `/auth/login/start` round-trip the client folds into the body.
 * ========================================================================== */

interface SeedOpts {
  role?: 'user' | 'admin';
  password: string;
  username?: string;
}

async function seedOpaqueUser(
  email: string,
  opts: SeedOpts,
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const userIdentifier = email.toLowerCase();

  const opaque = await opaqueRegister({
    userId: id,
    email: userIdentifier,
    password: opts.password,
  });

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email: userIdentifier,
      username: opts.username ?? null,
      role: opts.role ?? 'user',
      wrappedMainKey: opaque.wrappedMainKey,
      wrappedMainKeyIv: opaque.wrappedMainKeyIv,
      wrappedKekPassword: opaque.wrappedKekPassword,
      wrappedKekPasswordIv: opaque.wrappedKekPasswordIv,
      emailVerifiedAt: new Date(),
      registerState: 'complete',
    });
    await tx.insert(opaqueRecords).values({
      userId: id,
      envelope: opaque.registrationRecord,
    });
  });

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
 * Hono test app type (loose enough that any `buildApp()` instance fits)
 * ========================================================================== */

interface RequestableApp {
  request(input: string, init?: RequestInit): Response | Promise<Response>;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/* ============================================================================
 * `loginAs` — drives /auth/login/start + /finish through the test app
 * and returns the resulting session cookie. Replaces every test's
 * inline `loginAs` from the legacy Argon2id era.
 * ========================================================================== */

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

/* ============================================================================
 * `passwordProofFor` — runs a fresh /auth/login/start + client.finishLogin
 * round-trip and returns the body shape the new mutating routes
 * (change-password, change-email, delete-self) expect.
 *
 * Pairs with the proof verification helper in `routes/auth.ts`. The
 * resulting `proofLoginToken` is single-use — each mutating call
 * needs its own.
 * ========================================================================== */

export interface PasswordProofPayload {
  proofLoginToken: string;
  proofFinishLoginRequest: string;
}

export async function passwordProofFor(
  app: RequestableApp,
  email: string,
  password: string,
): Promise<PasswordProofPayload> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) {
    throw new Error(
      `passwordProofFor: /auth/login/start failed (${startRes.status}: ${await startRes.text()})`,
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
    throw new Error('passwordProofFor: client.finishLogin returned undefined');
  }
  return {
    proofLoginToken: loginToken,
    proofFinishLoginRequest: finished.finishLoginRequest,
  };
}

/** Extract the session cookie from a Set-Cookie header, for chaining requests. */
export function extractCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_session=([^;]+)/);
  return match ? `nodea_session=${match[1]}` : null;
}
