# Architecture

State of the codebase as of the close of the `refacto` migration cycle.
Every paragraph below describes code that exists today in the repository.

The repository is a **pnpm workspaces** monorepo with three packages and a
Docker-compose deployment bundle.

---

## 1. Workspace layout

```
/
├── packages/
│   ├── api/        # Node 22 · Hono · Drizzle · PostgreSQL 16
│   ├── web/        # React 19 · Vite · Tailwind · Zustand · TypeScript strict
│   └── shared/     # Zod schemas + branded crypto types, used by both sides
├── docs/           # This folder
├── docker-compose.yml
└── .env.example
```

- `packages/shared` is the **keystone**. Every type or schema used on both
  sides lives here — never duplicated. Zod schemas double as the source
  of truth for request/response bodies and for React Hook Form
  resolvers.
- `packages/api` builds the Hono HTTP server and owns the DB schema +
  migrations under `drizzle/`.
- `packages/web` ships the SPA. Vite builds into a static bundle served
  by nginx in production with a `/api/` reverse proxy to the API
  container.

---

## 2. Backend (`packages/api`)

### Runtime

- **Hono** on `@hono/node-server`, Node 22 ESM.
- **Drizzle ORM** against **PostgreSQL 16**. Schema:
  [`packages/api/src/db/schema.ts`](../packages/api/src/db/schema.ts).
  Migrations in [`packages/api/drizzle/`](../packages/api/drizzle/). Run
  `pnpm --filter @nodea/api db:generate` then `db:migrate` to create
  and apply.
- **Zod** at every request boundary, sharing schemas with the web
  package via `@nodea/shared`.
- **Session cookies** (HttpOnly, Signed, `SameSite=Lax`, `Secure` in
  prod). Backing `sessions` table; revoking a row kills the session
  immediately.
- **Argon2id** password hashing via `@node-rs/argon2`, server-side.
- **Nodemailer** for transactional mail (password reset). Falls back to
  a stderr logger when `SMTP_HOST` is unset (dev / tests).

### Route mounts (`packages/api/src/app.ts`)

```
/healthz
/auth              → routes/auth.ts
/admin             → routes/admin.ts          (requireAdmin)
/announcements     → routes/announcements.ts  (requireUser, public read)
/modules-config    → routes/modules-config.ts (1:1 per user, encrypted blob)
/user-preferences  → routes/user-preferences.ts (1:1 per user, encrypted blob)
/{collection}      → routes/collection-factory.ts  (one per entry table)
```

`/{collection}` is driven by `src/collections/registry.ts` — adding a
new module = adding an entry in that array, which is the single source
the factory loops over. There is nowhere to forget a guard.

### Middleware

- `requireUser` — resolves the session cookie to a row on the `users`
  table and `c.set('user', …)`.
- `requireAdmin` — stacks on `requireUser` and 403s non-admin roles.
- `requireGuard` — inside `collection-factory`, validates the
  `(module_user_id, guard)` query parameters on update/delete
  operations. **No `user_id` involvement** : entry rows carry no FK
  to `users`, the server cannot link a row to a specific user. The
  guard + sid combo is the only access decision (both require the
  user's main key to compute, so an attacker without the key cannot
  mutate even with a valid session cookie).
- `rateLimit` — in-memory fixed-window, keyed on IP. Applied to
  every `/auth/*` mutation and a few non-auth routes (library
  lookup). Full catalogue with windows + justification in
  [`Security.md §5.1`](./Security.md#51-rate-limit-table).

### Auth flow

> Detailed flows + threat model live in
> [`Auth-Spec.md`](./Auth-Spec.md). The summary below captures what
> the V1 code actually implements.

- **Login** (OPAQUE 2-step via `routes/auth.ts`, Phase 2C):
  - `POST /auth/login/start` runs `server.startLogin` and returns
    `{ loginResponse, loginToken }`. Anti-enum is built into the
    OPAQUE library: an unknown email gets a syntactically valid
    but cryptographically dead response (`registrationRecord: null`
    on the server side) — the client's `finishLogin` rejects it
    with the same shape as a wrong-password attempt.
  - Server-side state for the second round-trip lives in an
    in-memory map (`auth/opaque-login-state.ts`), keyed by a
    256-bit base64url token. Single-use, 5-minute TTL.
  - `POST /auth/login/finish` runs `server.finishLogin`, gates
    the user on `email_verified_at` (403 `account_not_activated`
    when NULL), creates a session, sets the signed cookie. No
    more dummy-hash timing trick — the legacy `POST /auth/login`
    is gone.
  - `GET /auth/me` surfaces the OPAQUE credential blobs
    (`wrappedMainKey{,Iv}` + `wrappedKekPassword{,Iv}`). Phase 2D
    dropped the legacy `encryptionSalt` / `encryptedKey` fields.

- **Change password** (OPAQUE 2-step via
  `/auth/change-password/start` + `/finish`, Phase 2D):
  - The client first re-derives the current `exportKey` via a
    `/auth/login/start` round-trip with the typed current
    password. The resulting proof goes in the body.
  - `/start` validates the proof, runs OPAQUE
    `createRegistrationResponse` for the new password, returns
    `{ registrationResponse, changePasswordToken }`. Pending
    state lives in `auth/opaque-pending-state.ts`.
  - The client unwraps the current KEK, finishes OPAQUE
    registration locally with the new password, re-wraps the
    SAME KEK under the new `exportKey`, posts to `/finish`.
  - `/finish` consumes the token, replaces the
    `opaque_records.envelope` and `users.wrapped_kek_password{,_iv}`
    in a transaction, revokes every session, mints a fresh one.
    Main key envelope (`wrapped_main_key`) stays put — every
    pre-change ciphertext stays readable.
  - UX: form requires the new password typed twice + a live
    strength check (`checkPasswordRules` from `@nodea/shared` +
    zxcvbn band, gates submit on rules-passed + score ≥ 3),
    same as Register. On success the client also runs
    `useSession.logout()` and redirects to
    `/login?password-changed=1` — the server already revoked
    every session as part of the rotation; we align the local
    state by dropping the in-memory main-key material and
    asking the user to re-authenticate with the new password.

- **Recovery code KEK** (Auth-Roadmap Phase 3, Auth-Spec §7.7) —
  the non-destructive password-recovery option:
  - Setup is opt-in from Settings → Security tab. The user types
    their current password (proof + KEK derivation), the client
    generates 12 BIP39 words via `@scure/bip39`, derives a wrap
    key from the entropy via HKDF, wraps the KEK, computes
    `SHA-256(entropy)` for the server. Mnemonic is shown ONCE
    in a 4×3 grid + ack checkbox.
  - A red `SidebarTipRecoveryCode` warns logged-in users without
    a code yet, non-dismissable until they act on it.
  - When the user later forgets their password, `/recover` does
    OPAQUE register on the new password (folded inside
    `/auth/recover-kek/start`'s response), unwraps the KEK
    locally with the typed mnemonic, re-wraps under the new
    `exportKey`, ships the lot to `/finish`. Server-side: hash
    compared in constant time, every credential blob rotated +
    a NEW recovery code generated client-side and shown ONCE.
    Pre-recovery ciphertexts stay readable (the main key
    didn't move).
  - Anti-enum on `/start`: unknown emails (and known emails with
    no recovery code) get fresh random blobs that the client
    can't unwrap; the response shape and timing are
    indistinguishable from a known-user path.

- **Reset password** (OPAQUE 2-step via `/auth/reset/start` +
  `/finish`, Phase 2D):
  - The reset email's token is the auth proof; `/start` validates
    it, runs `createRegistrationResponse`, returns `{ registration
    Response, resetToken, userId }`.
  - The client generates a fresh main key + fresh KEK (the old
    main key is unrecoverable since the password is forgotten),
    wraps both, ships to `/finish`.
  - `/finish` purges every user-owned encrypted row + replaces
    every credential blob in the same transaction.

- **Change-email / delete-self**:
  - Both routes are gated by `requireFreshPassword` (see Re-auth
    foundation below) — no embedded password proof in the body.
    The caller has run `/auth/reauth/password` within the last
    5 minutes, which stamps `sessions.reauth_password_at`.

- **Re-auth foundation + matrix wiring** (Phase 7A + 7B —
  `routes/auth-reauth.ts`,
  `middleware/require-fresh-reauth.ts`):
  - Two timestamps live on the session row:
    `reauth_password_at` and `reauth_passkey_at`. They're stamped
    on every auth path that promotes to `full`: password login
    finish, passkey login finish, MFA finalize (propagated from
    the pending row's `mfa_*_verified` flags), change-password
    rotation, recovery-code reset.
  - `bumpSessionReauth(sessionId, factor)` in `auth/session.ts`
    flips a single timestamp to `now()`; used by
    `/auth/reauth/{password,passkey}/finish` after they verify a
    fresh proof. `getSessionReauth(sessionId)` reads both
    timestamps for the middleware.
  - `requireFreshPassword` /
    `requireFreshPasswordOrPasskey` middlewares chain after
    `requireUser` and 401 with `{error:'reauth_required',
    reauth_required:'password'|'password_or_passkey'}` when the
    relevant timestamp is older than 5 min. The SPA reads
    `reauth_required` to decide which modal to surface.
  - `POST /auth/reauth/password/{start,finish}` runs an OPAQUE
    login round-trip on the calling session — the user identifier
    is taken from the session, never from the body, so an
    attacker holding A's cookie can't run a proof against B's
    record.
  - `POST /auth/reauth/passkey/{start,finish}` runs a WebAuthn
    assertion against the calling user's enrolled credentials
    (re-uses the `pending_webauthn_challenge` column on the full
    session row, TTL 5 min — same as the stepped-MFA path).
  - Phase 7B applied the middlewares to every mutating Settings
    route (security-mode, totp, passkey, recovery-code,
    change-password, change-email, delete-self) and dropped the
    embedded `proofLoginToken` body shape that pre-7B routes
    accepted. Front-end migrated from `derivePasswordProof` (one
    OPAQUE round-trip per action, embedded in body) to
    `freshenPasswordReauth` (one round-trip via
    `/auth/reauth/password`, then a session-fresh action call).

- **Register** (OPAQUE 2-step via `routes/auth-register-v2.ts`,
  Phase 2B):
  - The form requires email + **username** (public display name,
    "prénom ou pseudo") + password. Username is a free-form
    display name with no uniqueness check — duplicates are allowed
    (the actual identifier is `users.id`, login keys on `email`).
    Password proof goes through the OPAQUE handshake
    (`@serenity-kit/opaque`) — the server never sees the
    plaintext password. Stored credential = `opaque_records.envelope`.
  - **Step 1** `POST /auth/register/start` — stateless, returns the
    OPAQUE response blob + a fresh `userId` the client uses as the
    AAD anchor for the wrapped main-key + KEK blobs.
  - **Step 2** `POST /auth/register/finish` — receives the
    persisted `registrationRecord` plus `wrappedMainKey{,Iv}` and
    `wrappedKekPassword{,Iv}`, runs the same invited / open /
    closed branching as before, and inserts both rows
    (`users` + `opaque_records`) in a transaction.
  - **Invited path** — admin issues an invite via `POST /admin/invites
    { email }` → server emails a `/register?invite=<token>` link →
    user clicks → form pre-fills the email (read-only) → finish
    consumes the invite atomically (strict email match,
    `SELECT … FOR UPDATE`) → account created with
    `email_verified_at = now()` (the email click proved control).
  - **Open path** — when `app_settings.open_registration = true`,
    `/register` accepts free signup → account created with
    `email_verified_at = NULL` → activation email sent → user clicks
    `/auth/register/activate` → `email_verified_at` flipped.
  - **Closed path** — `open_registration = false` and no token → 403
    `registration_closed`. The frontend gates this case via
    `GET /auth/register/mode` so users see a panel instead of an
    error.
  - The legacy single-shot `POST /auth/register` is gone; admin /
    seed scripts insert directly into the `users` table with
    `email_verified_at = now()` to bypass the activation gate.
- **Login**: always runs `verifyPassword` to keep timing identical
  between "unknown email" and "wrong password". Dummy hash used when
  the email doesn't match any row. **Refuses 403
  `account_not_activated`** when `users.email_verified_at IS NULL`,
  surfaced as a precise UI message ("Ton compte n'est pas encore
  activé").
- **Change password / reset / change-email / delete-self**: see the
  dedicated bullets above — all four moved to OPAQUE proof bodies in
  Phase 2D. Reset still purges every user-owned encrypted row before
  rotating credentials (the old main key is unrecoverable once the
  password is forgotten); change-password rotates the KEK envelope
  but leaves the main-key wrap untouched, preserving every existing
  ciphertext. Reset-token shape unchanged: 32-byte random, SHA-256
  hashed, 1h TTL (R13 / #22).

- **Passkey (WebAuthn + PRF)** (Phase 4 — `routes/auth-passkey.ts`):
  - Five authenticated routes (`enroll/start`, `enroll/finish`,
    `list`, `:id/label`, `:id/remove`) for Settings, two anonymous
    routes (`login/start`, `login/finish`) for the login flow.
  - Server primitives via `@simplewebauthn/server@13.3.0`. Challenges
    persisted on `sessions.pending_webauthn_challenge` for enrollment
    (TTL 5 min) and on a single-use in-memory pending entry
    (`auth/passkey-login-state.ts`) for login. UV `'required'` is
    enforced both via the lib and by re-checking
    `userVerified === true` server-side (Auth-Spec §9.3).
  - The KEK is wrapped per-credential under `HKDF(prf_output,
    "nodea:wrap-kek")`, AAD =
    `nodea:v1\x1f<userId>\x1fpasskey\x1f<credentialId>` so a server-
    side row swap between two of the user's passkeys fails the
    auth-tag at decrypt time. Non-PRF authenticators are stored
    `prf_supported=false` with NULL wrap blobs (login-only — the user
    chains a password to unlock data).
  - The `:id/remove` handler runs the §6.1 downgrade auto: removing
    the last PRF-capable passkey while `security_mode = 'maximum'`
    flips it back to `password_or_passkey` in the same transaction.
  - Client orchestration in `core/auth/passkey-flow.ts` keeps the
    WebAuthn dance + PRF eval injection out of `useSession`, which
    only exposes high-level `enrollPasskey` / `loginWithPasskey` /
    `removePasskey` / `renamePasskey` surfaces.

- **TOTP + stepped MFA + security mode** (Phase 5 — `routes/auth-totp.ts`,
  `routes/auth-mfa.ts`, `routes/auth-security-mode.ts`):
  - `auth-totp.ts` — 4 authenticated routes for the management
    surface: `enroll/start`, `enroll/verify`, `disable`,
    `backup-codes/regenerate`. All gate on a fresh OPAQUE password
    proof. `disable` runs the §6.1 downgrade auto if
    `security_mode in ('always_totp', 'maximum')`.
  - `auth-mfa.ts` — stepped MFA verify routes operating on the
    `mfa_pending` session kind via `requireMfaPending` middleware.
    `POST /auth/mfa/totp/verify` accepts a TOTP code OR a 24-char
    backup code in the same `code` field; backup codes are
    single-use via `UPDATE WHERE used_at IS NULL`.
    `POST /auth/mfa/passkey/start` + `/finish` drive the passkey-
    as-second-factor flow for mode `maximum` (allow-credentials
    scoped to the user — no anti-enum needed since they're already
    authenticated). Both verify routes auto-finalize when no
    factors remain (DELETE pending + INSERT full atomically via
    `finalizeMfaSession`).
  - `auth-security-mode.ts` — `POST /auth/security-mode/change`
    with §6.1 prerequisite validation (`400 totp_required` /
    `400 passkey_required`). Downgrades to `password_or_passkey`
    are always accepted.
  - The primary login routes (`/auth/login/finish` and
    `/auth/passkey/login/finish`) compute required factors via
    `auth/mfa-policy.ts` and emit `mfa_pending` instead of `full`
    when `security_mode != 'password_or_passkey'`. The wrap blobs
    ride along the response since `/auth/me` refuses pending
    sessions — the client unwraps the KEK + main key locally
    while the session is still pending (Auth-Spec §7.2.bis: no
    leak because no full cookie = no data routes accessible).
  - Helpers: `auth/totp.ts` wraps `otplib@13.4.0` with the spec
    params (SHA-1 / 6 / 30s, ±1 window skew, returns matched
    window for anti-replay). `auth/totp-backup-codes.ts` generates
    10 × 120-bit base32 codes with 4-4-4-4-4-4 hyphenation,
    SHA-256 hashed. `auth/session.ts` gains `finalizeMfaSession`
    + `mfaFlags` option on `createSession`.
  - Frontend: `core/auth/use-session.ts` exposes `startTotpEnrollment`
    / `verifyTotpEnrollment` / `disableTotp` / `regenerateTotpBackupCodes`
    / `verifyMfaTotp` / `verifyMfaPasskey` / `changeSecurityMode`.
    Pages: `/totp` (Settings TOTP setup), `/login/mfa` (stepped
    MFA, drives TOTP then passkey when needed). Settings → Sécurité
    tab gains a "Mode de sécurité" section with 3 cards + inline
    password confirm form + UI gates that grey out modes whose
    prerequisites aren't met.

- **MFA bypass by email (TOTP / passkey, 7 days)** (Phase 6 —
  `routes/auth-mfa-bypass.ts`, `auth/mfa-bypass.ts`):
  - 2 routes: `POST /auth/mfa/bypass/request` (mfa_pending) and
    `GET /auth/mfa/bypass/confirm?t=<token>` (anonymous). No cancel
    email link — auto-cancel-on-login defangs forged requests when
    the legit owner signs in normally, keeping an attacker-
    controlled "click here to defuse" surface out of the inbox. The
    confirm GET returns JSON; the email link points at the SPA
    (`/auth/bypass/confirm?t=…`), which fetches the API and renders
    a styled page (matching `/totp`, `/passkeys`) with a live `Jj
    HHh MMmin` countdown to the `earliestApplyAt`.
  - Eligibility check (`bypassEligibility`) enforces Auth-Spec
    §6.2 "perdu 2 trucs = niqué": mode `maximum` requires the
    other factor verifiable in the pending session before the
    bypass for X is allowed. Failure → 409 `multi_factor_loss` →
    UI redirects to `/request-reset` (destructive).
  - Lazy application (`applyConsumableBypass`) runs at the start
    of `/auth/login/finish` and `/auth/passkey/login/finish` BEFORE
    computing required factors. A confirmed-past-delay bypass:
    disables TOTP + purges backup codes (totp factor) OR deletes
    every `auth_factors kind='passkey'` (passkey factor); auto-
    downgrades `security_mode` → `password_or_passkey` per §6.1;
    marks `consumed_at`; revokes every other session of the user.
    Notification email "récupération appliquée" is best-effort
    (failure doesn't block login).
  - Auto-cancel on full-session promotion
    (`cancelPendingBypassesForUser`) flips `cancelled_at` on every
    pending request whenever the user lands a full session — at
    `/auth/login/finish`, `/auth/passkey/login/finish`,
    `/auth/mfa/{totp,passkey}/finish`, and after a recovery-code
    reset. Rationale: a successful login proves the user still
    controls the factor they claimed to have lost (and defangs an
    attacker who triggered a bypass against them).
  - Tokens: 32 bytes random base64url, SHA-256 hashed in
    `mfa_bypass_requests.confirm_token_hash`. The `cancel_token_hash`
    column is NOT NULL in the schema and gets a placeholder hash
    that nothing on the wire will ever match — kept to avoid a DB
    migration. The DB only holds hashes; plaintext lives only in
    the confirm email.
  - Frontend: `/login/mfa` surfaces "j'ai perdu mon X" links under
    each step (TOTP / passkey) → inline confirm dialog → email
    sent. No Settings UI: a full session implies the bypass got
    auto-cancelled, so there's nothing to display.
  - No cron — consumption is triggered by the next login. The
    request itself has a TTL of 7 days (so a never-confirmed
    request doesn't sit forever), which is enforced by the
    `expires_at` check in `applyConsumableBypass`.

### Background jobs

A single `node-cron` schedule lives in
[`packages/api/src/cron/index.ts`](../packages/api/src/cron/index.ts),
started from `index.ts` after `buildApp()` :

- **`cleanup-unactivated-accounts`** — Mondays 03:00 UTC. Purges
  expired `email_verifications` rows + the inactive `users` whose
  activation window (7 days) has elapsed, plus stale sessions. Logs a
  summary line per run (`[cron] cleanup-unactivated done {…}`).

### Tests

Vitest against a real Postgres instance (Docker). Single fork,
sequential to avoid row-level interference. Setup under
[`packages/api/src/test/setup.ts`](../packages/api/src/test/setup.ts)
runs `TRUNCATE … CASCADE` before each test, and forces
`EMAIL_SERVICE_IMPL=recording` (cf. `vitest.config.ts`) so suites can
assert on outgoing mail without spinning up Mailpit. 221 integration
tests at the time of writing, covering register / login / activation
gates, OPAQUE round-trips, OPAQUE re-auth, change-password / reset /
change-email / delete-self, recovery-code KEK, passkey enroll +
login + PRF unwrap, TOTP enroll + verify, stepped MFA (TOTP +
passkey-as-2FA), security-mode change with §5.4 session rotation,
MFA bypass-by-email, admin CRUD, invites (send / resend / revoke),
collection round-trips, announcements, user preferences. End-to-
end Playwright smoke + TOTP scenarios live in `packages/e2e/`.

---

## 3. Frontend (`packages/web`)

### Stack

- **React 19** + **Vite 6** + **Tailwind 4** (via
  `@tailwindcss/vite`).
- **TypeScript strict**, `allowJs: false`,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. A few
  flow-module entrypoints remain in JSX (Mood, Goals, Passage —
  restored verbatim from the legacy); their types are stubbed via
  ambient declarations in
  [`src/types/legacy-modules.d.ts`](../packages/web/src/types/legacy-modules.d.ts).
- **Zustand** is the single application store, see
  [`src/core/store/nodea-store.ts`](../packages/web/src/core/store/nodea-store.ts).
  Slices: `auth`, `crypto`, `modules`, `preferences`, `notifications`,
  `mobileMenuOpen`. There is **no** parallel singleton or Context
  reducer.
- **React Hook Form + Zod** for every form that ships to the server —
  resolver built from the shared schema.
- **Routing**: URL-driven (`/flow/:moduleId`). Every module is
  `React.lazy()` so opening "Mood" for the first time fetches only
  Mood's code chunk. Per-module `ErrorBoundary`.

### State slices

| Slice            | Source of truth                    | Wiped at logout |
| ---------------- | ---------------------------------- | --------------- |
| `auth`           | `GET /auth/me`                     | yes             |
| `crypto.main`    | Derived from password at login     | yes             |
| `modules`        | Encrypted `modules_config` payload | yes             |
| `preferences`    | Encrypted `user_preferences`       | yes             |
| `notifications`  | Local only (toast queue)           | yes             |
| `mobileMenuOpen` | Local only (sidebar drawer)        | yes             |

### Data access

- **Typed REST client** at
  [`src/core/api/client.ts`](../packages/web/src/core/api/client.ts) —
  thin `fetch` wrapper that parses responses with the shared Zod
  schemas. Ships the session cookie via `credentials: 'include'`.
- **Collection client factory** at
  [`src/core/api/modules/collection-client.ts`](../packages/web/src/core/api/modules/collection-client.ts).
  Encapsulates the full E2E loop: encrypt → POST init → derive guard →
  PATCH promote on create; decrypt on list; derive guard on update /
  delete. Every module's data client is one line on top of this
  factory.
- **Legacy-shaped adapters** (`goals-legacy.js`, `passage-legacy.js`)
  expose the PocketBase-style function signatures the restored JSX
  modules were written against — they flatten the typed records into
  the shape the view layer expects without a rewrite.

### Crypto (`src/core/crypto/`)

- **Base64 / randomBytes**: one central module
  ([`base64.ts`](../packages/web/src/core/crypto/base64.ts)) — no other
  encoder/decoder in the codebase.
- **HKDF domain separation**: the raw 32-byte main key is stretched
  into two distinct sub-keys (`"nodea:aes"` and `"nodea:hmac"`) via
  HKDF before import into `CryptoKey`. AES and HMAC never share bytes.
- **Branded types** (`AesMainKey`, `HmacMainKey`, `Base64`, `CipherIV`,
  `EncryptedBlob`) from `@nodea/shared/crypto-types` prevent mixing
  domains at compile time.
- **Guard derivation** (`guard-derivation.ts`): deterministic
  HMAC-SHA-256 over `moduleUserId || ':' || recordId` with the HMAC
  sub-key. No network round-trip.
- **Two-layer wrap** (`factor-wrap.ts`): the main key is wrapped
  under a random KEK (label `nodea:wrap-main`), the KEK is wrapped
  under an HKDF sub-key of the OPAQUE `exportKey` (label
  `nodea:wrap-kek`). AAD bound to `users.id` (+ a per-factor tag
  for the KEK wrap) so a row-swap on the server can't pass off
  one user's blob as another's. The legacy single-step Argon2id
  envelope (`envelope.ts`) was removed in Phase 2D.

### UI

- `packages/web/src/ui/atoms/` is TSX-only as of #23 / R14. Small typed
  primitives (Button, Modal, Input, Select, Textarea, Surface,
  SurfaceCard, TableShell, …).
- Per-module pages live at `src/app/flow/<Module>/`. Mood, Goals and
  Passage kept their legacy JSX subtree (restored from `fb68d85`) — the
  subtree as a whole is lazy-loaded and behind an ambient declaration
  so TSX code sees a typed shape.

### Tests

Vitest + jsdom. Crypto round-trips (AES, HKDF, factor-wrap, guard
derivation, passkey-PRF unwrap), base64 encoders, the typed HTTP
client (mocked fetch), and the Zustand store. 83 unit tests at the
time of writing.

---

## 4. Shared (`packages/shared`)

Zod schemas live under `src/schemas/`:

- `auth.ts` — register/login/change-password/change-email/change-username
  /delete-self/request-reset/reset-password bodies + `/auth/me`
  response.
- `entries.ts` — the generic 1:1 `modules_config` body wrapper.
- `modules.ts` — decrypted payload schemas for each module (Mood,
  Goals, Passage, Habits items + logs, Library items + reviews,
  Review).
- `announcements.ts` — create / update / response for the admin feed.
- `preferences.ts` — `UserPreferencesBodySchema` wrapper +
  `UserPreferencesPayloadSchema` (decrypted: theme, language, …).

`crypto-types.ts` exports the branded types that travel across the API
boundary (`Base64`, `CipherIV`, `EncryptedBlob`).

---

## 5. Docker deployment

Single `docker-compose.yml` at the repo root:

- `postgres` — PostgreSQL 16 image, data in a named volume.
- `api` — Node image running `packages/api`. On boot it runs
  `db:migrate` against the postgres service.
- `web` — nginx serving the Vite build. Reverse proxy maps `/api/` →
  `api:3000`, so the SPA and API share a single origin (no CORS in
  prod).

Config is driven by a single root `.env`; see `.env.example` for every
knob (Postgres, cookie secret, SMTP, `WEB_BASE_URL`, web port).

---

## 6. Conventions

- TypeScript everywhere new. No `any`. `unknown` + narrowing when
  needed.
- Never duplicate a schema or type between web and api — move it to
  `@nodea/shared`.
- Every mutation on an entry table goes through the guard
  middleware. Entry rows carry no `user_id` column (minimum-readable-
  surface design — the server never links a user to an entry) ; the
  guard validates `(sid, guard)` only. The 1:1 blobs that skip the
  guard (`modules_config`, `user_preferences`) are keyed PK on
  `user_id` and gated by `requireUser`, documented in their route
  files.
- Crypto additions respect HKDF domain separation and use branded
  types.
