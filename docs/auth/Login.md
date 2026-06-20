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
   │  If mode = password_or_passkey:     │
   │     POST /auth/mfa/finalize         │
   │  If mode = always_2fa/maximum:     │
   │     ... TOTP, plus password if max ...│
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

### Reusing the login endpoints to add a factor

When the current mode requires multiple factors and entry happens
through only one (for example: passkey-first in `maximum` mode →
the pending session has `mfa_passkey_verified=true` but lacks
`mfa_password_verified`), the client calls **the same login
endpoints** again to complete:

- To add a password verification: `POST /auth/login/start` then
  `/auth/login/finish` with the `__Host-nodea_mfa` cookie active.
  The server detects the pending session (instead of creating a
  new one) and bumps `mfa_password_verified=true`.
- To add a passkey verification: `POST /auth/passkeys/login/start`
  then `/finish`. Bumps `mfa_passkey_verified=true`.
- To add a TOTP verification: `POST /auth/mfa/totp/verify`. Bumps
  `mfa_totp_verified=true`.

No new cookie is issued during these steps; we operate on the same
`mfa_pending` until `/auth/mfa/finalize`.

### Finalisation

`POST /auth/mfa/finalize`

**Server**:
1. Load the cookie's `mfa_pending` session.
2. Compute the required factors from `users.security_mode` + entry
   path:

   | mode | password-first | passkey-first |
   |---|---|---|
   | `password_or_passkey` | password | passkey |
   | `always_2fa` | password + (totp **OR** passkey) | passkey + totp |
   | `maximum` | password + passkey + totp | passkey + password + totp |

   Issue #72 — in `always_2fa` password-first, the 2nd factor is
   an OR set : the client can verify TOTP **or** assert any
   enrolled passkey (PRF or non-PRF). Either satisfies the
   policy ; `/auth/mfa/finalize` does not gate on which path was
   taken. Passkey-first stays TOTP-only (a second passkey
   assertion on the same login would be redundant).

3. Verify every required column in `mfa_*_verified`. If one is
   missing → 400 `{ missing: [...] }`.
4. Transaction:
   - DELETE the `mfa_pending` session.
   - INSERT a full session, populate `reauth_password_at` /
     `reauth_passkey_at` according to what was done during the
     pending phase.
   - Issue `__Host-nodea_session`.
5. Response `200 { user, ...some public info }`.

