# Register — single form + activation magic link

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.1 Register — single form + activation magic link

### Overview

A single form (email + password) on the UI side, two server paths
depending on the mode:

```
┌─ Email invitation (recommended) ──────────────────────────────────┐
│                                                                   │
│ Admin → /admin/invites { email }                                  │
│      → server emails link `/register?invite=<token>`              │
│ User clicks → form pre-filled (email read-only) → submit          │
│      → server creates account + activates immediately (1 mail)    │
│      → redirect /login?activated=1                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Open registration (admin toggle ON) ─────────────────────────────┐
│                                                                   │
│ User → /register without a token → open form → submit             │
│      → server creates inactive account + sends activation email   │
│ User clicks → /activate?token=<...> → flips activated             │
│      → redirect /login?activated=1                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Closed (admin toggle OFF, no link) ──────────────────────────────┐
│                                                                   │
│ User → /register without a token → "Invite-only" page + login link│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

No "register session" cookie in V1 — state survives only via the
URL invitation token or via the verification row server-side.

### `POST /auth/register/start` + `POST /auth/register/finish` (OPAQUE 2-step, V1 ✅)

**Body** `/start`
```json
{
  "email": "alice@example.com",
  "registrationRequest": "<opaque-blob>",
  "inviteToken": "<base64url, optional>"
}
```

**Response** `/start`
```json
{
  "registrationResponse": "<opaque-blob>",
  "userId": "<uuid v4>"
}
```

`/start` is **stateless** — no DB write, no invite consumption, no
DB row created. It pre-validates the path (invite present + email
match, or `open_registration` ON) to fail fast, then calls
`server.createRegistrationResponse()` from `@serenity-kit/opaque`
with `userIdentifier = email.toLowerCase()`. The returned `userId`
is used by the client to compute AAD bindings
(`buildKekAAD(userId, 'password')` and `buildMainKeyAAD(userId)`)
BEFORE posting `/finish`.

**Body** `/finish`
```json
{
  "email": "alice@example.com",
  "username": "Alice",
  "userId": "<uuid returned by /start>",
  "registrationRecord": "<opaque envelope>",
  "wrappedMainKey": "<base64 AES-GCM>",
  "wrappedMainKeyIv": "<base64 IV>",
  "wrappedKekPassword": "<base64 AES-GCM>",
  "wrappedKekPasswordIv": "<base64 IV>",
  "wrappedKekRecovery": "<base64 AES-GCM>",
  "wrappedKekRecoveryIv": "<base64 IV>",
  "recoveryCodeHash": "<64 hex chars — SHA-256(entropy)>",
  "inviteToken": "<base64url, optional>"
}
```

`username` is **required** at register — `UsernameField` rules
(2-32 chars, letters/digits/`_`/`-`/`.`, accents OK). Presented to
the user as "a first name or a handle". **Not unique**: two
accounts can carry the same display name (the real identifier
remains `users.id` + `users.email` for login).

`registrationRecord` is the OPAQUE envelope produced client-side
by `client.finishRegistration()`. The server persists it in
`opaque_records.envelope` — it **cannot** be used to recover the
password (that's the whole point of OPAQUE).

`wrappedMainKey` / `wrappedKekPassword` / `wrappedKekRecovery` are the
client-side wrap layers (cf. §3.2):
- **Main key** (32 random bytes) wrapped under KEK via HKDF label
  `nodea:wrap-main`, AAD = `nodea:v1\x1f<userId>\x1fmain`.
- **KEK** (32 random bytes) wrapped under an HKDF-derived key from
  the OPAQUE `exportKey` via label `nodea:wrap-kek`, AAD =
  `nodea:v1\x1f<userId>\x1fpassword`.
- **KEK again** wrapped under `HKDF(entropy, "nodea:wrap-kek")` from a
  fresh BIP39 12-word recovery phrase, AAD =
  `nodea:v1\x1f<userId>\x1frecovery`, plus `recoveryCodeHash =
  SHA-256(entropy)`. The recovery factor is **mandatory at signup**
  (§7.7): the client generates the phrase in `prepareRegistration`,
  reveals it + runs the transcription quiz, and only THEN posts
  `/finish` — abandoning the quiz creates no account. The recovery
  code itself never reaches the server (only its hash).

**Server branches** on `/finish`:

1. **Invited** (`inviteToken` present):
   - `consumeInviteAndCreateUser(token, email, …)`:
     - Lookup `invites` by `code_hash`, under `SELECT … FOR UPDATE`.
     - Reject if used / expired / unknown → 401 `invalid_token`.
     - Reject if `invites.email !== body.email` (strict match) →
       400 `email_mismatch`.
     - INSERT `users { id: userId, username,
       wrappedMainKey, wrappedMainKeyIv,
       wrappedKekPassword, wrappedKekPasswordIv,
       wrappedKekRecovery, wrappedKekRecoveryIv, recoveryCodeHash,
       recoveryAcknowledgedAt: now(),
       emailVerifiedAt: now(), registerState: 'complete' }`.
     - INSERT `opaque_records { user_id: userId, envelope:
       registrationRecord }`.
     - UPDATE `invites { usedBy, usedAt }`.
   - Response `200 { ok: true, activated: true, email }`. No
     cookie issued — the user re-types their password at `/login`.

2. **Open registration** (no token, toggle ON):
   - Verify `app_settings.open_registration === true` (defense in
     depth — `/start` already checked).
   - If `users` (active OR inactive) already exists with this
     email → silent 200 (anti-enum). Retrying on the inactive row
     **is no longer** a reuse since the AADs of the new `/start`
     userId diverge from the previous one — the original
     activation email stays valid, the admin can resend out of
     band. **Dual-mail pattern (issue #45)** : alongside the silent
     200, the API emails the rightful owner of the address an
     informational notice (`register-already-exists` tag) so a
     legitimate user who forgot they already have an account isn't
     stranded waiting for an activation link that never comes. The
     submitter sees no difference — same status code, same body,
     same response shape as a free email — so anti-enum holds on
     their side. Only the actual owner of the email (who can read
     their own mailbox) learns that an attempt was made.
     - Throttle : 1 notice per email per 1 h, in-memory map (cf.
       `services/email/already-exists-throttle.ts`). Prevents the
       route from being a notification spam vector ; the legitimate
       user re-trying within the hour still gets the silent 200.
     - Trade-off : the 2nd+ register within the hour short-circuits
       the mailer call (~50 ms saved), creating a small timing
       oracle distinguishable from a free email. Accepted — the
       gap sits below the OPAQUE handshake's own variance, and the
       primary defence (the submitter cannot tell from the response
       alone) still holds.
   - Otherwise: INSERT `users { id: userId, …,
     emailVerifiedAt: NULL }` + INSERT `opaque_records`, in a
     transaction.
   - INSERT `email_verifications { kind: 'register', codeHash:
     SHA-256(token), expiresAt: now+7d }`.
   - Email "Activate your Nodea account" via `EmailService.send`.
   - Response `200 { ok: true, activated: false }`.

3. **Closed** (no token, toggle OFF):
   - 403 `registration_closed`. The frontend gates this case
     upstream via `GET /register/mode` (see below).

**Argon2id on the Nodea side**: no code path uses Argon2id for
auth; the only remaining Argon2id is the one
`@serenity-kit/opaque` runs internally as part of the
OPAQUE-3DH-RISTRETTO255-SHA512-Argon2id suite.

### `POST /auth/register/activate`

Target of the open path's magic link. **Not called on the invited
path** — the invitee is already active at submit time.

**Body**: `{ token: "<base64url>" }`.

Server:
1. `consumeEmailVerification('register', token)` — lookup +
   timing-safe compare + single-use consume.
2. UPDATE `users { emailVerifiedAt: now() }` WHERE id = verification.userId
   AND emailVerifiedAt IS NULL. If no match → 401 `already_consumed`.
3. Response `200 { ok: true, email }`.

Specific errors: `invalid_token` (401), `already_consumed` (401),
`expired` (410).

### `GET /auth/register/mode`

Public, no rate-limit in V1. Returns `{ openRegistration: boolean }`
read from `app_settings`. The frontend calls it on `/register` mount
to decide between an open form and an "Invite-only" page.

### `GET /auth/register/invite-info?token=…`

Public, rate-limit 30/h/IP. Returns `{ email, expiresAt }` when the
token is valid + unconsumed + unexpired; 404 otherwise. Lets the
frontend pre-fill the email when the user arrives via
`/register?invite=…`.

### Activation gate on `POST /auth/login`

Once the account is created, login refuses if
`users.email_verified_at IS NULL`:

```ts
if (user.emailVerifiedAt === null) {
  return c.json({ error: 'account_not_activated' }, 403);
}
```

The UI surfaces a banner "Your account isn't activated yet. Click
the link sent by email to activate it." Seeded admins legally
bypass (we insert them with `emailVerifiedAt = now()` in `seed.ts`).

### Cleanup of unactivated accounts

Monday 03:00 cron (cf. §13.2):
- DELETE `email_verifications` `kind = 'register'`
  `expires_at < now()`.
- DELETE `users` where `emailVerifiedAt IS NULL` AND no pending
  `email_verifications` → the 7-day window has elapsed.

### V1 trade-offs accepted

- **Multi-use invitations**: no strict invite → user link. An
  invite isn't bound to a user at submit time and isn't consumed
  at activation — the same invite can serve several registers.
  Tightening to single-use = adding a `users.invite_id` FK;
  deferred post-V1.
- **Change-email cooldown bypassable via destructive reset**: the
  destructive reset doesn't (re-)arm `email_changed_at`, so
  chaining reset + immediate change-email is possible. Residual
  risk accepted in V1 (cf. §2.2 #7).

---

