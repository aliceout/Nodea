# Login (password-first, passkey-first) + stepped MFA finalisation

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.2 Login password-first

```
Client                                Server
   │                                     │
   │  client.startLogin(password)        │
   │   → { clientLoginState, KE1 }       │
   │                                     │
   │  POST /auth/login/start             │
   │  { email, startLoginRequest: KE1 }  │
   │────────────────────────────────────▶│
   │                                     │  load opaque_records by email
   │                                     │  (null when unknown — anti-enum)
   │                                     │  server.startLogin → KE2 + state
   │                                     │  storeLoginState(state) → token
   │  { loginResponse: KE2, loginToken } │
   │◀────────────────────────────────────│
   │                                     │
   │  client.finishLogin(password,       │
   │    clientLoginState, KE2)           │
   │   → { finishLoginRequest: KE3,      │
   │       sessionKey, exportKey }       │
   │  (undefined on wrong password / fake KE2 — anti-enum)
   │                                     │
   │  POST /auth/login/finish            │
   │  { loginToken, finishLoginRequest } │
   │────────────────────────────────────▶│
   │                                     │  consumeLoginState(token) → state
   │                                     │  server.finishLogin verifies KE3
   │                                     │  load user by userIdentifier
   │                                     │  (refuses 403 if not activated)
   │                                     │  createSession + setSessionCookie
   │  { id }   + Set-Cookie: nodea_session
   │◀────────────────────────────────────│
   │                                     │
   │  GET /auth/me/crypto                │
   │       → wrappedKekPassword,         │
   │         wrappedMainKey, …           │
   │  (lean GET /auth/me hit for the     │
   │   rest of the profile, API-14 split)│
   │                                     │
   │  unwrapKekUnderFactor(exportKey)    │
   │   → KEK                             │
   │  unwrapMainKeyUnderKek(KEK)         │
   │   → mainKey                         │
   │  deriveMainKeys(mainKey)            │
   │   → aesKey + hmacKey                │
```

## 7.3 Login passkey-first

```
Client                                Server
   │                                     │
   │  POST /auth/passkeys/login/start    │
   │  { email? }   (email optional —     │
   │               WebAuthn supports the │
   │               "discoverable" flow)  │
   │────────────────────────────────────▶│
   │                                     │  load auth_factors
   │                                     │  generate challenge
   │  { challenge, allowCredentials }    │
   │◀────────────────────────────────────│
   │                                     │
   │  navigator.credentials.get(...)     │
   │  with the fixed PRF eval input      │
   │  → assertion + prf_output           │
   │                                     │
   │  POST /auth/passkeys/login/finish   │
   │  { credential_id, signature, ... }  │
   │────────────────────────────────────▶│
   │                                     │  verify signature
   │                                     │  bump sign_count
   │                                     │  emit mfa_pending
   │                                     │   - mfa_passkey_verified=true
   │  { needs_mfa, user_id }             │
   │◀────────────────────────────────────│
   │                                     │
   │  client: if prf_supported           │
   │     derive wk_passkey               │
   │     unwrap wrapped_kek for the cred │
   │     unwrap main_key                 │
   │                                     │
   │  client: if non-PRF                 │
   │     KEK unwrap is impossible        │
   │     ─▶ screen "This passkey can't  │
   │         decrypt your data. Type    │
   │         your password to finish."  │
   │     ─▶ mode password_or_passkey :  │
   │         the /finish session is     │
   │         FULL but keyless, so the   │
   │         client drops it (logout)   │
   │         and the user re-auths with │
   │         a full /auth/login         │
   │     ─▶ mode always_2fa/maximum :   │
   │         the session is mfa_pending,│
   │         so it is KEPT and the      │
   │         password is added as a 2nd │
   │         factor (mfa_password_      │
   │         verified) before finalize  │
   │                                     │
   │  password_or_passkey : the assertion│
   │    at /passkeys/login/finish IS the  │
   │    full login — no MFA step.         │
   │  always_2fa : + TOTP via            │
   │    /auth/mfa/totp/verify.            │
   │  maximum : + password + TOTP via    │
   │    /auth/mfa/{password,totp}/*.      │
   │  Each /auth/mfa/* route finalizes   │
   │    inline (no /auth/mfa/finalize).   │
```

**PRF input**: a fixed input `"nodea:prf-v1"` (32 bytes, zero-padded)
is used client-side so that `prf_output` is deterministic for a given
credential, independent of the WebAuthn challenge (which changes on
every login).

**Non-PRF passkey on `password_or_passkey`** (`core/auth/session/passkeys.ts`):
in this mode a passkey assertion is a *complete* login, so `/finish`
returns a **full** session — but a non-PRF credential can't unwrap the
main key. We do **not** keep that session: an authenticated-but-keyless
client would be bounced straight back out by the Layout's key-missing
guard the moment it reached `/flow` (the "passkey lets me in, then
kicks me to /login" bug). Instead the client drops the session
(`/auth/logout`), resets its store, and shows the « finish with your
password » prompt; the password form then performs a normal full login
that derives the key. The `mfa_pending` "keep the session, add the
password as a factor" path applies **only** to `always_2fa`/`maximum`,
where the passkey was never a complete login on its own.

## 7.4 Stepped MFA — finalisation

### Adding a remaining factor (dedicated `/auth/mfa/*` routes)

When the current mode requires multiple factors and entry happens
through only one (for example: passkey-first in `maximum` mode →
the pending session has `mfa_passkey_verified=true` but lacks
`mfa_password_verified`), the client calls **the same login
endpoints** again to complete:

- To add a password verification: `POST /auth/mfa/password/start` then
  `/auth/mfa/password/finish` (OPAQUE handshake on the pending
  session). Gated by `requireMfaPending`; the OPAQUE identifier is the
  pending session's user, never the body. Bumps
  `mfa_password_verified=true`. (Needed for mode `maximum` entered
  passkey-first — its remaining factors are password + totp.)
- To add a passkey verification: `POST /auth/mfa/passkey/start` then
  `/auth/mfa/passkey/finish`. Bumps `mfa_passkey_verified=true`.
- To add a TOTP verification: `POST /auth/mfa/totp/verify`. Bumps
  `mfa_totp_verified=true`.

No separate cookie or `/auth/mfa/finalize` call is involved: each
`/auth/mfa/*` route operates on the same `mfa_pending` cookie and, the
moment the verified flags satisfy the mode, promotes the row to a
`full` session in the same request (`finalizeMfaSession`) and swaps the
cookie. The response is `{ finalized: true }` or
`{ finalized: false, missing: [...] }`.

### Finalisation (inline, no separate endpoint)

There is **no** `POST /auth/mfa/finalize` route. Finalisation happens
**inside each `/auth/mfa/*` verify handler**: after it sets its
`mfa_*_verified` flag it calls `missingFactors(user, session)` against
the mode matrix below, and if nothing is missing it promotes the row
in the same request.

Required factors after the entry factor (`auth/mfa-policy.ts`):

| mode | password-first | passkey-first |
|---|---|---|
| `password_or_passkey` | — | — |
| `always_2fa` | totp **OR** passkey | totp |
| `maximum` | passkey + totp | password + totp |

Issue #72 — in `always_2fa` password-first, the 2nd factor is an OR
set : the client can verify TOTP **or** assert any enrolled passkey.
Either satisfies the policy. Passkey-first stays TOTP-only (a second
passkey assertion on the same login would be redundant).

When `missingFactors(...)` returns empty, the handler:
1. Cancels any pending MFA-bypass for the user
   (`cancelPendingBypassesForUser`).
2. In one transaction (`finalizeMfaSession`): DELETE the `mfa_pending`
   row, INSERT a `full` session, propagating `reauth_password_at` /
   `reauth_passkey_at` from whichever factors were proved.
3. Swaps the session cookie and returns `{ finalized: true }`.

Otherwise it returns `{ finalized: false, missing: [...] }` and the
client drives the next `/auth/mfa/*` step.

