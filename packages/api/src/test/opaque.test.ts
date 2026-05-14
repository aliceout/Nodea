/**
 * In-memory OPAQUE protocol round-trip — sanity check that the lib
 * works in our Node 22 env and that our server wrapper agrees with
 * `@serenity-kit/opaque`'s client side. Phase 2A scaffolding test;
 * the live HTTP routes get covered in 2B (register) + 2C (login).
 *
 * No DB hits — the protocol is fully in-process here. Test is loud
 * if the lib's WASM init fails or if the export_key changes between
 * register and login (which would silently brick every account).
 */
import { describe, it, expect } from 'vitest';
import { client, ready, server } from '@serenity-kit/opaque';
import {
  createRegistrationResponse,
  finishLogin as serverFinishLogin,
  opaqueReady,
  startLogin as serverStartLogin,
} from '../auth/opaque.ts';

const PASSWORD = 'Correct-Horse-Battery-Staple-42';
const WRONG_PASSWORD = 'Wrong-Mule-Diesel-Stapler-99';
const USER_IDENTIFIER = 'alice@example.com';

/**
 * Each test instantiates its own setup — the OPAQUE_SERVER_SETUP env
 * var stays decoupled from these tests. The wrapper still needs the
 * env var for code paths that go through `getOpaqueServerSetup()`,
 * but here we exercise the lib directly to validate the round-trip.
 */
async function runRegister(serverSetup: string) {
  await ready;
  const { clientRegistrationState, registrationRequest } =
    client.startRegistration({ password: PASSWORD });
  const { registrationResponse } = server.createRegistrationResponse({
    serverSetup,
    userIdentifier: USER_IDENTIFIER,
    registrationRequest,
  });
  return client.finishRegistration({
    password: PASSWORD,
    clientRegistrationState,
    registrationResponse,
  });
}

describe('OPAQUE protocol — in-memory round-trip', () => {
  it('boots the WASM module via `await ready`', async () => {
    await expect(opaqueReady).resolves.toBeUndefined();
  });

  it('register → login produces the same export_key on both sides', async () => {
    const serverSetup = server.createSetup();
    const reg = await runRegister(serverSetup);

    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: PASSWORD,
    });
    const { serverLoginState, loginResponse } = server.startLogin({
      serverSetup,
      userIdentifier: USER_IDENTIFIER,
      registrationRecord: reg.registrationRecord,
      startLoginRequest,
    });
    const finished = client.finishLogin({
      password: PASSWORD,
      clientLoginState,
      loginResponse,
    });
    expect(finished).toBeDefined();
    const { finishLoginRequest, sessionKey: clientSession, exportKey } =
      finished!;

    const { sessionKey: serverSession } = server.finishLogin({
      serverLoginState,
      finishLoginRequest,
    });

    // Symmetric key agreement: both sides land on the same session key.
    expect(serverSession).toBe(clientSession);
    // Stable export_key: register and login must derive the same value
    // — if they didn't, every account would brick on first login.
    expect(exportKey).toBe(reg.exportKey);
  });

  it('rejects login with the wrong password (client finishLogin returns undefined)', async () => {
    const serverSetup = server.createSetup();
    const reg = await runRegister(serverSetup);

    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: WRONG_PASSWORD,
    });
    const { loginResponse } = server.startLogin({
      serverSetup,
      userIdentifier: USER_IDENTIFIER,
      registrationRecord: reg.registrationRecord,
      startLoginRequest,
    });
    const finished = client.finishLogin({
      password: WRONG_PASSWORD,
      clientLoginState,
      loginResponse,
    });
    expect(finished).toBeUndefined();
  });

  it('produces an indistinguishable response for an unknown identifier (anti-enum)', async () => {
    // A login attempt against an identifier that has no record must
    // still return a syntactically valid `loginResponse` so a probing
    // attacker can't use response shape / latency to enumerate users.
    // The client's finishLogin then rejects (undefined) just like a
    // wrong-password attempt.
    const serverSetup = server.createSetup();
    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: PASSWORD,
    });
    const { loginResponse } = server.startLogin({
      serverSetup,
      userIdentifier: 'ghost@example.com',
      registrationRecord: null,
      startLoginRequest,
    });
    expect(loginResponse).toBeTypeOf('string');
    expect(loginResponse.length).toBeGreaterThan(0);

    const finished = client.finishLogin({
      password: PASSWORD,
      clientLoginState,
      loginResponse,
    });
    expect(finished).toBeUndefined();
  });
});

describe('OPAQUE wrapper — server-side surface', () => {
  it('createRegistrationResponse + startLogin + finishLogin agree end-to-end', async () => {
    // Drives the wrapper functions directly — they read
    // OPAQUE_SERVER_SETUP from env. Tests inherit `.env` through the
    // vitest config so the var is present.
    if (!process.env.OPAQUE_SERVER_SETUP) {
      // The wrapper functions throw with a helpful message, but the
      // test environment is supposed to provide the setup. Fail loud.
      throw new Error(
        'OPAQUE_SERVER_SETUP missing from test env — set it in .env (or Infisical).',
      );
    }

    await ready;
    const { clientRegistrationState, registrationRequest } =
      client.startRegistration({ password: PASSWORD });
    const { registrationResponse } = createRegistrationResponse({
      userIdentifier: USER_IDENTIFIER,
      registrationRequest,
    });
    const reg = client.finishRegistration({
      password: PASSWORD,
      clientRegistrationState,
      registrationResponse,
    });

    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: PASSWORD,
    });
    const { serverLoginState, loginResponse } = serverStartLogin({
      userIdentifier: USER_IDENTIFIER,
      registrationRecord: reg.registrationRecord,
      startLoginRequest,
    });
    const finished = client.finishLogin({
      password: PASSWORD,
      clientLoginState,
      loginResponse,
    });
    expect(finished).toBeDefined();

    const { sessionKey: serverSession } = serverFinishLogin({
      serverLoginState,
      finishLoginRequest: finished!.finishLoginRequest,
    });
    expect(serverSession).toBe(finished!.sessionKey);
  });
});
