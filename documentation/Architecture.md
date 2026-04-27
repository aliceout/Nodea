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
├── documentation/  # This folder
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
- `requireGuard` — inside `collection-factory`, validates the HMAC
  guard query parameter on update/delete operations.
- `rateLimit` — in-memory fixed-window, keyed on IP. Applied to every
  `/auth/*` mutation (`/auth/register`, `/auth/register/activate`,
  `/auth/register/invite-info`, `/auth/login`, `/auth/request-reset`,
  `/auth/reset`).

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

- **Change-email / delete-self** (Phase 2D):
  - Both routes take an `OpaquePasswordProof` body
    (`{ proofLoginToken, proofFinishLoginRequest }`) — same shape
    as change-password's proof. Server validates via
    `verifyPasswordProof` (consume the login state, run
    `server.finishLogin`).
  - Phase 7 will add a re-auth fresh-window middleware so the
    proof can be cached across multiple privileged calls.

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
- **Change password**: server expects a re-wrapped envelope
  (`encryptionSalt` + `encryptedKey`) produced by the client under the
  new password. Revokes every other session and issues a fresh one.
- **Reset password** (R13 / `#22`): token 32-byte random, SHA-256
  hashed, 1h TTL. Consuming a token runs a transaction that purges
  every user-owned encrypted row (8 entry tables + `modules_config` +
  `user_preferences`) before rotating credentials — the old envelope
  is unreachable without the old password, so we refuse to keep dead
  ciphertexts around.

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
assert on outgoing mail without spinning up Mailpit. 98 integration
tests at the time of writing, covering auth (single-form register,
invite-bound + open paths, activation, login activation gate),
admin CRUD, invite send/resend/revoke, app settings toggle,
collection round-trips, announcements, user preferences, password
reset.

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
- **Envelope** (`envelope.ts`): `wrapMainKey(password, raw) →
  { encryptionSalt, encryptedKey }` and `unwrapMainKeyBytes` for login.
  Argon2id via `hash-wasm`.

### UI

- `packages/web/src/ui/atoms/` is TSX-only as of #23 / R14. Small typed
  primitives (Button, Modal, Input, Select, Textarea, Surface,
  SurfaceCard, TableShell, …).
- Per-module pages live at `src/app/flow/<Module>/`. Mood, Goals and
  Passage kept their legacy JSX subtree (restored from `fb68d85`) — the
  subtree as a whole is lazy-loaded and behind an ambient declaration
  so TSX code sees a typed shape.

### Tests

Vitest + jsdom. Crypto round-trips (AES, HKDF, envelope, guard
derivation), base64 encoders, the typed HTTP client (mocked fetch),
and the Zustand store. 56 unit tests at the time of writing.

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
- Every mutation on an entry table goes through the guard middleware.
  The only 1:1 blobs that skip it (`modules_config`,
  `user_preferences`) are keyed PK on `user_id` — `requireUser` is
  sufficient, which is documented in the route files themselves.
- Crypto additions respect HKDF domain separation and use branded
  types.
