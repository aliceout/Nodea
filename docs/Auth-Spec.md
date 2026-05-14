# Auth-Spec — Authentication + MFA full specification

> **Precedence.** Code and doc = single source of truth (CLAUDE.md).
> Code wins over the spec when divergence is observed → fix the
> code OR the spec in the same PR that introduces the divergence.

---

## Table of contents

0. [Quick read](#0-quick-read)
1. [Overview](#1-overview)
2. [Threat model](#2-threat-model)
3. [Cryptographic model](#3-cryptographic-model)
4. [Database schema](#4-database-schema)
5. [Cookies & sessions](#5-cookies--sessions)
6. [Re-auth matrix](#6-re-auth-matrix)
7. [Full flows](#7-full-flows)
8. [TOTP — details](#8-totp--details)
9. [Passkey — details](#9-passkey--details)
10. [Email service](#10-email-service)
11. [Server middlewares](#11-server-middlewares)
13. [Frozen algorithms & parameters](#13-frozen-algorithms--parameters)
14. [Forbidden anti-patterns](#14-forbidden-anti-patterns)
15. [Test matrix](#15-test-matrix)
16. [Pitfalls recap](#16-pitfalls-recap)

---

## 0. Quick read

### 0.1 Current state (post-Phase 8)

| Question | Short answer | Detail |
|---|---|---|
| How is an account created? | Single `email + password` form; activation via a magic email link before the account is usable | §7.1 |
| How do invitations work? | Admin enters an email address, the server emails a `?invite=<token>` link; no copy-paste code | §7.1 |
| What gates login? | `users.email_verified_at IS NOT NULL` + factors required by `security_mode` (Auth-Spec §6) | §7.2, §6 |
| Open registration? | Admin toggle `open_registration`, default OFF | §7.1 |
| What derives the KEK? | OPAQUE `export_key` (Phase 2) **or** WebAuthn PRF (Phase 4) **or** BIP39 recovery code (Phase 3) | §3.2 |
| Does TOTP derive anything? | **No** — session gate only, secret in cleartext on the server (cf. §2.3). | §2.3, §8 |
| OPAQUE identifier? | `users.email` (changing email = OPAQUE re-register — the route will do it once §7.6 is completed) | §7.6 |
| How many KEK wraps? | 1 password + N PRF passkeys + 1 recovery code | §3.2 |
| Is "Maximum security" mode a crypto split? | **No**, UX gate only | §2.3 |
| Yubikey without PIN accepted? | **No** — UV `'required'`, passkey without unlock refused | §9.3 |
| Can a server operator read my data? | **No** — the KEK never sits on the server | §2.1 |
| Can a server operator bypass TOTP? | **Yes** (TOTP = partial-trust server) | §2.2 |
| Could a compromised web server exfiltrate my key via injected JS? | **Inherent limit of the web model** — mitigated by SRI on the entry chunk + an INTEGRITY.txt manifest published with each release, plus an explicit recommendation to self-host for sensitive use | `nodea.app/docs/security/tech` ("Intégrité du bundle") |

---

## 1. Overview

### 1.1 Goals

Nodea auth rests on a multi-factor E2E model that:

- preserves E2E **even when the server is compromised** (vs just
  "honest-but-curious") — KEK derived from the OPAQUE `export_key`,
  no server-side Argon2id over the password;
- accepts passkeys (WebAuthn) with KEK derivation via PRF when the
  authenticator supports it;
- adds an optional TOTP gate for sessions;
- offers an explicit **crypto recovery path** (BIP39 recovery code)
  that doesn't erode the E2E property;
- offers a 7-day MFA email bypass to recover a lost factor without
  destructive reset;
- exposes a coherent re-auth matrix for every sensitive change;
- mitigates the "compromised server serves tampered JS" threat model
  via SRI on the entry chunk + an INTEGRITY.txt manifest at every
  release.

### 1.2 Permanent invariants

Whatever happens, these invariants hold:

1. **Client-only main key.** 32 random bytes generated at signup.
   Never transmitted. Wrapped server-side under a key the server
   doesn't have.
2. **HKDF domain separation** between `aes` and `hmac` — labels
   `nodea:aes` and `nodea:hmac`, unchanged.
3. **Non-extractable `CryptoKey`** imported once, lives in memory
   until logout.
4. **Branded TypeScript types** (`Base64`, `AesMainKey`,
   `HmacMainKey`, etc.) in `packages/shared/src/crypto-types.ts`.
5. **HMAC guards** on entry mutations, derived from the HMAC
   sub-key.
6. **Destructive reset** kept as a last-resort safety net.
7. **No "logged-in without key"**: status `crypto.missing` →
   blocking `KeyMissingModal`.

---

## 2. Threat model

### 2.1 What we defend against (and how)

| Adversary | Capability | What we guarantee | Mechanism |
|---|---|---|---|
| **Honest-but-curious server operator** | Full DB + log read | **No** readable plaintext. KEK and main key remain inaccessible. | OPAQUE (export_key client-only), PRF (prf_output client-only), AES-GCM auth-tag, AAD bound to `users.id` |
| **Network attacker (locally broken TLS)** | MitM | No leakage if TLS is OK; OPAQUE partially resists a lying server | OPAQUE binds to the server static key, HSTS in prod, `Secure` cookies |
| **Session thief** (stolen session cookie) | Cookie in the clear | Bounded lifetime, revocation via DELETE FROM sessions, SameSite=Lax. Maximum mode requires passkey + TOTP at renewal. | §5 |
| **Device thief with active session** | OS access | Bounded by session lifetime; cold reload purges the main key (status `missing`); maximum mode requires passkey/TOTP at renewal | §5 |
| **Email thief (compromised mail account)** | Destructive reset possible, TOTP bypass possible after 7 days | **Potential data loss** (destructive reset) or **TOTP bypass** (with 7-day delay); no plaintext leakage without the OPAQUE password or recovery code | §7.8, §7.9 |
| **Phisher** | Fake Nodea site | FIDO passkey resistant via origin-binding. OPAQUE is **not** anti-phishing (a fake site can run OPAQUE register on its own server). | Documented in §2.3 |
| **Online brute-forcer** | Repeated attempts | Rate-limit on `/auth/login`, OPAQUE includes server-side Argon2id | §13 |
| **Offline brute-forcer (DB exfil)** | Cracking on a dump | OPAQUE = no offline-crackable password hash; high Argon2id parameters as fallback | §13 |
| **Cross-user blob-swap attack** | DB tampering | AAD `users.id` binds each blob to its owner | §3.4 |

### 2.2 What we don't defend against

Stated explicitly so no PR claims to fix these angles without
re-opening the spec:

1. **Compromised server with tampered JS bundle**:
   - TOTP becomes bypassable (the server controls verification).
   - Passkey signatures can be bypassed if the server accepts any
     response.
   - **What stays protected**: the KEK behind the OPAQUE export_key
     and the PRF prf_output (computed in the client). As long as
     the browser runs the official bundle and the passkey is used
     correctly, the attacker doesn't recover the main key.
   - "Maximum security" mode **does not increase** crypto protection
     against this adversary — it's a UX gate.
2. **Active malware on the user's machine**: keylogger, malicious
   extension with DOM access, compromised autofill. We have no way
   to defend this surface from the server or the bundle.
3. **Passkey without gesture (missing UV)**: refused by construction
   at enrollment time (UV `'required'`, cf. §9.3). This vector is
   eliminated upstream, not in the crypto layer.
4. **Coercion (rubber-hose)**: if the user is forced to hand over
   password + passkey + TOTP, we lose. That's a physical problem,
   not a crypto one.
5. **Side channels**: fine timing attacks on OPAQUE, cache leaks,
   microarchitecture. Out of scope.
6. **Simultaneous loss** of password + every passkey + recovery
   code + email: destructive reset only. **Data lost.** The user
   is warned at every step.
7. **Change-email cooldown bypassable via destructive reset**.
   An attacker who takes over the victim's email can trigger a
   destructive reset followed immediately by a change-email (the
   7-day cooldown is not (re-)armed by the reset). **V1 residual
   risk accepted**: destructive reset wipes all data, the recovered
   account is empty, so the incentive to re-open a stolen account
   under another address is low. If we observe this vector,
   mitigate by setting `email_changed_at = now()` at the end of
   the destructive reset.

### 2.3 Documented trade-offs

- **TOTP is a session gate, not a cryptographic gate.** The TOTP
  secret has to be stored in the clear on the server (protocol
  requirement: the server must be able to verify the code). So a
  server operator who has obtained the OPAQUE password can
  technically bypass TOTP server-side and obtain the
  `wrapped_kek_*`. TOTP protection rests **entirely** on server
  integrity. OPAQUE and PRF stay E2E even with a compromised
  server.
- **"Maximum security" mode is a UX gate, not a Shamir 2-of-2.**
  Refusing the Shamir option avoids complexity blowup (mode change
  = re-split, losing a passkey in max mode = data loss except via
  recovery code, etc.). Maximum mode raises resistance to device
  theft or stolen sessions, not to a compromised server.
- **Passkeys with UV `'required'`.** Any passkey without an unlock
  gesture (PIN, biometric, manager unlock) is refused at
  enrollment. Practical consequences:
  - Yubikey without a configured PIN → the browser triggers PIN
    setup, or enrollment is blocked.
  - Software passkeys (Bitwarden, iCloud Keychain, 1Password,
    Google PM) → OK, manager unlock = UV.
  - TouchID / FaceID / Windows Hello → OK.
  Pure hardware theft without a gesture therefore no longer
  unlocks the KEK.
- **Phishing.** OPAQUE is not anti-phishing. A fake site can
  capture the password by running an OPAQUE register on its own
  server. FIDO passkeys **are** anti-phishing (origin-bound). We
  encourage passkeys but don't make them mandatory.
- **OPAQUE identifier = email.** Changing the email implies a full
  OPAQUE re-register (which needs the plaintext password
  client-side at that moment, already available via fresh
  re-auth). Heavy but consistent.
- **KEK recovery code shown only once.** If the user doesn't note
  it down, the only recourse on password + passkey loss is the
  destructive reset. Documented at signup, blocking screen with a
  checkbox.
- **Minimum readable surface on entry tables.** No entry row
  carries a `user_id` or a column timestamp. The server cannot
  link an entry to a user in plain SQL or date a row write.
  Self-delete is client-driven (sids enumerated from
  `modules_config`, then deletion by sid + guard). Details and
  rationale in
  [`Architecture.md §7`](Architecture.md#7-common-modules-schema).

---

## 3. Cryptographic model

The detail of primitives, key hierarchy (KEK / main key / wraps),
frozen HKDF labels (`nodea:wrap-kek`, `nodea:wrap-main`,
`nodea:aes`, `nodea:hmac`), and AAD construction via `buildAAD()`
lives in the "Modèle cryptographique" doc in
[`tech.md`](../packages/web/src/app/pages/docs/content/tech.md)
(rendered at [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)).
That doc is the source of truth; any evolution happens there, not
here.

**Direct consequences** specific to auth (for memory):

- Login = unwrap KEK via **one** factor → unwrap main key → HKDF AES + HMAC.
- Add/remove passkey = add/remove a `wrapped_kek_passkey_*` blob. No impact on the other factors; the main key bytes never change.
- Change password = re-wrap **only** `wrapped_kek_password`. The KEK doesn't change, the main key doesn't change, **no existing ciphertext is touched**.
- Recovery code regeneration = re-wrap **only** `wrapped_kek_recovery`. Same.
- KEK regeneration: out of scope V1 (equivalent to a crypto re-onboarding).

---

## 4. Database schema

> Tables and columns described here mirror
> `packages/api/src/db/schema.ts`.

### 4.0 Existing preserved tables (out of auth scope)

Tables that exist independently of the auth chantier:

| Table | Use | Touched by destructive reset (§4.3)? |
|---|---|---|
| `invites` | ✅ V1 — email-bound invitations (Bitwarden-style); `email + token_hash`; cf. §7.1 | no (consumed at signup) |
| `app_settings` | ✅ V1 — key/value store for app config (V1 stores `open_registration`; future settings: TOTP mode, etc.) | no |
| `modules_config` | Per-module per-user config, encrypted | yes (DELETE WHERE user_id) |
| `user_preferences` | Per-user UI prefs, encrypted | yes |
| `mood_entries`, `goals_entries`, `passage_entries`, `habits_*_entries`, `library_*_entries`, `review_entries` | Encrypted module data | **no** (since migration 0012 — no `user_id` on these tables, the server can't identify a user's entries to purge; orphan rows accepted) |

All other tables (auth + MFA + sessions) are defined in §4.1.

### 4.1 Tables (Drizzle PostgreSQL)

```ts
// packages/api/src/db/schema/users.ts

export const securityMode = pgEnum('security_mode', [
  'password_or_passkey', // default: one factor unlocks
  'always_2fa',         // 2nd factor (TOTP or passkey) required after password ; TOTP after passkey-first
  'maximum',             // password + passkey + TOTP, all three
]);

export const registerState = pgEnum('register_state', [
  'pre_register',     // row created, email not verified yet
  'email_verified',   // email code validated, can continue
  'password_set',     // OPAQUE registration done
  'recovery_set',     // KEK recovery code shown and acknowledged
  'complete',         // optionals (TOTP, passkey) handled, full session emitted
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').notNull().default(false),
  securityMode: securityMode('security_mode').notNull().default('password_or_passkey'),
  registerState: registerState('register_state').notNull().default('pre_register'),
  // Main wrap: the main key under the KEK. ONCE, never re-wrapped.
  wrappedMainKey: text('wrapped_main_key'),  // base64(AES-GCM(...))
  wrappedMainKeyIv: text('wrapped_main_key_iv'),
  // KEK wrap by password (OPAQUE): 1:1 with users.
  wrappedKekPassword: text('wrapped_kek_password'),
  wrappedKekPasswordIv: text('wrapped_kek_password_iv'),
  // KEK wrap by recovery code: 1:1 with users.
  wrappedKekRecovery: text('wrapped_kek_recovery'),
  wrappedKekRecoveryIv: text('wrapped_kek_recovery_iv'),
  // SHA-256 hex of the BIP39 entropy (16 bytes for 12 words) of the recovery code.
  // Lets the server authorise the recover-kek flow without knowing the code
  // (130 bits → uncrackable offline). Cf. §7.7.
  recoveryCodeHash: text('recovery_code_hash'),
  recoveryAcknowledgedAt: timestamp('recovery_acknowledged_at', { withTimezone: true }),
  // Change-email cooldown (cf. §7.6): 7 days between two changes
  emailChangedAt: timestamp('email_changed_at', { withTimezone: true }),
  onboardingStatus: text('onboarding_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// packages/api/src/db/schema/opaque.ts

// 1:1 with users. No separate PK — keyed on user_id.
// The table exists to decouple OPAQUE rotation from other fields.
export const opaqueRecords = pgTable('opaque_records', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  envelope: bytea('envelope').notNull(),       // OPAQUE registration record
  // Version of the OPAQUE server static key used for this envelope.
  // Allows server static key rotation (issue #39) without breaking
  // existing accounts. The current key lives in `OPAQUE_SERVER_SETUP`
  // (env var); previous versions will be stored in an
  // `opaque_server_keys` table when we tackle #39.
  serverKeyVersion: integer('server_key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// packages/api/src/db/schema/auth-factors.ts

export const authFactorKind = pgEnum('auth_factor_kind', ['passkey']);

export const authFactors = pgTable('auth_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: authFactorKind('kind').notNull(),
  // WebAuthn fields
  credentialId: bytea('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),    // COSE-encoded
  signCount: integer('sign_count').notNull().default(0),
  // Disabled for authenticators that don't maintain the counter
  // (notably Apple). Heuristic: signCount = 0 on >=3 consecutive
  // assertions → flip to false. Cf. §9.6.
  signCountStrict: boolean('sign_count_strict').notNull().default(true),
  transports: text('transports'),              // CSV: "usb,nfc,internal"
  prfSupported: boolean('prf_supported').notNull().default(false),
  // KEK wrap by PRF (NULL for non-PRF passkey)
  wrappedKek: text('wrapped_kek'),
  wrappedKekIv: text('wrapped_kek_iv'),
  // Metadata
  label: text('label'),                        // user-facing: "Personal Yubikey", "iPhone"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('auth_factors_user_idx').on(table.userId),
}));
```

```ts
// packages/api/src/db/schema/mfa.ts

export const mfaTotp = pgTable('mfa_totp', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  secret: bytea('secret').notNull(),           // 20 random bytes, IN CLEARTEXT (cf. §2.3)
  algo: text('algo').notNull().default('SHA1'),
  digits: integer('digits').notNull().default(6),
  period: integer('period').notNull().default(30),
  lastWindow: bigint('last_window', { mode: 'number' }), // anti-replay
  enabledAt: timestamp('enabled_at', { withTimezone: true }), // null = pending
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mfaTotpRecoveryCodes = pgTable('mfa_totp_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),       // SHA-256 hex
  usedAt: timestamp('used_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('mfa_totp_recovery_user_idx').on(table.userId),
}));

export const mfaFactor = pgEnum('mfa_factor', ['totp', 'passkey']);

export const mfaBypassRequests = pgTable('mfa_bypass_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  factor: mfaFactor('factor').notNull(),       // 'totp' or 'passkey'
  confirmTokenHash: text('confirm_token_hash').notNull(),
  cancelTokenHash: text('cancel_token_hash').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Only one active request at a time per user, across factors.
  // Prevents instant chaining of passkey-bypass + totp-bypass.
  uniqueActive: uniqueIndex('mfa_bypass_one_active')
    .on(table.userId)
    .where(sql`cancelled_at IS NULL AND consumed_at IS NULL`),
}));
```

```ts
// packages/api/src/db/schema/email-verifications.ts

export const emailVerificationKind = pgEnum('email_verification_kind', [
  'register',     // step 2 of multi-step register
  'email_change', // email change from Settings
]);

export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),              // target email (may differ from users.email during a change)
  kind: emailVerificationKind('kind').notNull(),
  codeHash: text('code_hash').notNull(),       // SHA-256 of the 6-digit code
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('email_verifications_email_idx').on(table.email),
}));
```

```ts
// packages/api/src/db/schema/sessions.ts

export const sessionKind = pgEnum('session_kind', [
  'full',         // fully authenticated session
  'mfa_pending',  // OPAQUE/passkey OK, MFA required before promotion
  'register',    // registration in progress, scope restricted to /auth/register/*
  'migrate',     // legacy user mid-migration Argon2id → OPAQUE
                  // scope /auth/migrate/*, TTL 30 min
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: sessionKind('kind').notNull(),
  // Factor freshness markers (re-auth matrix)
  reauthPasswordAt: timestamp('reauth_password_at', { withTimezone: true }),
  reauthPasskeyAt: timestamp('reauth_passkey_at', { withTimezone: true }),
  // For mfa_pending: factors already verified
  mfaPasswordVerified: boolean('mfa_password_verified').notNull().default(false),
  mfaPasskeyVerified: boolean('mfa_passkey_verified').notNull().default(false),
  mfaTotpVerified: boolean('mfa_totp_verified').notNull().default(false),
  // Ephemeral WebAuthn challenge for this session (5 min TTL).
  // Allows enrollment + assertion without a Redis dependency (cf. §9.2).
  pendingWebauthnChallenge: text('pending_webauthn_challenge'),
  pendingWebauthnChallengeAt: timestamp('pending_webauthn_challenge_at', { withTimezone: true }),
  // Metadata
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
}, (table) => ({
  userKindIdx: index('sessions_user_kind_idx').on(table.userId, table.kind),
}));
```

### 4.2 DB constraints & invariants

To enforce via constraints or triggers, otherwise check in server
code:

1. `users.wrapped_main_key` is NOT NULL **after** transition to
   `register_state >= 'password_set'`. NULL only tolerated before.
2. `users.wrapped_kek_password` NOT NULL after `password_set`.
3. `users.wrapped_kek_recovery` NOT NULL after `recovery_set`.
4. `users.recovery_code_hash` NOT NULL after `recovery_set`
   (parallel to 3 — always stored alongside the wrap blob).
5. **`maximum` mode**: `users.security_mode = 'maximum'` implies
   `mfa_totp.enabled_at IS NOT NULL` **AND** at least one
   `auth_factors WHERE kind = 'passkey' AND prf_supported = true`
   row. Enforced server-side by §6.1 (activation + auto downgrade).
6. Only one `mfa_bypass_requests` not-cancelled-not-consumed per
   user (conditional unique index above).
7. `auth_factors.wrapped_kek IS NULL` ⟺ `prf_supported = false`.
8. `mfa_totp.enabled_at IS NULL` = enrollment in progress, not yet
   usable for login.
9. `email_verifications.attempts <= 5`. Beyond, the row is purged
   by a job + a new request is forced.

### 4.3 Data purged at destructive reset

(Cf. §7.9 — recap for the Drizzle migration.)

**Important note**: the module entry tables don't carry a `user_id`
— the server therefore can't identify or purge them at reset time.
Orphan rows stay (lost main key, unreadable). The reset only purges
the 1:1-FK-cascadeable tables on the user.

```sql
-- Module tables: no purge possible (no user_id column).
-- Rows survive, unreadable, until possible manual ops cleanup.

DELETE FROM modules_config WHERE user_id = $1;
DELETE FROM user_preferences WHERE user_id = $1;
DELETE FROM auth_factors WHERE user_id = $1;
DELETE FROM mfa_totp WHERE user_id = $1;
DELETE FROM mfa_totp_recovery_codes WHERE user_id = $1;
DELETE FROM mfa_bypass_requests WHERE user_id = $1;
DELETE FROM email_verifications WHERE user_id = $1;
DELETE FROM sessions WHERE user_id = $1;
DELETE FROM opaque_records WHERE user_id = $1;
UPDATE users SET
  wrapped_main_key = NULL, wrapped_main_key_iv = NULL,
  wrapped_kek_password = NULL, wrapped_kek_password_iv = NULL,
  wrapped_kek_recovery = NULL, wrapped_kek_recovery_iv = NULL,
  recovery_code_hash = NULL,
  recovery_acknowledged_at = NULL,
  security_mode = 'password_or_passkey',
  register_state = 'email_verified',  -- email-verified is preserved
  onboarding_status = 'pending'
WHERE id = $1;
```

The whole sequence in **one transaction**.

---

## 5. Cookies & sessions

### 5.1 Cookies

| Cookie | Lifetime | Routes accepted (middleware) | Issued when | Promoted to |
|---|---|---|---|---|
| `__Host-nodea_register` ✅ | 24h | `/auth/register/*` | After successful email verification (wizard step 2) | Cleared at the end of register |
| `__Host-nodea_mfa` ✅ | 5 min | `/auth/mfa/*` | After OPAQUE/passkey login finish | `__Host-nodea_session` once MFA completes |
| `__Host-nodea_migrate` (vestigial) | 30 min | `/auth/migrate/*` | No longer issued — no code path mints it since the Argon2id model was removed | `__Host-nodea_session` after crypto migration |
| `nodea_session` ✅ | 7 days (fixed, **no** slide) | everything else | Full login | Forced re-login after 7 days or revocation |

Every cookie:
- `HttpOnly`
- `Secure` in prod (and every non-localhost environment)
- `SameSite=Lax`
- Signed (`COOKIE_SECRET`, min 32 chars)
- `__Host-` prefix (locks to the domain, **forces** `Path=/` on
  the browser side, and requires `Secure`).

**Important note on scoping**: the `__Host-` prefix forces
`Path=/`, so every cookie travels with **every** request to the
domain. The "Routes accepted" column above is **not** a cookie
attribute: it's what the `loadSession` middleware checks. The
`requireUser`, `requireRegisterSession`, `requireMfaPending`,
`requireMigrate` middlewares only read **their** expected cookie
and refuse the others. If multiple cookies are present, each is
valid only on its own route set.

This choice sacrifices a bit of "least-privilege" on the browser
side in favor of `__Host-`'s anti-subdomain property (no cookie
poisoned by a compromised subdomain). Trade-off accepted.

### 5.2 Unified session model

The four kinds live in `sessions` with a `kind` column. The
`loadSession` middleware:

1. Reads the cookie matching the route:
   - `/auth/register/*` → `__Host-nodea_register` → `kind = 'register'`
   - `/auth/mfa/*` → `__Host-nodea_mfa` → `kind = 'mfa_pending'`
   - `/auth/migrate/*` → `__Host-nodea_migrate` → `kind = 'migrate'`
   - otherwise → `__Host-nodea_session` → `kind = 'full'`
2. Loads the row, checks correct `kind` + `expires_at > now()`.
3. Silently refuses (cookie ignored) if the `kind` doesn't match
   the route.
4. Updates `last_seen_at` (atomic, debounced to 1 min to avoid
   spamming the DB).

### 5.3 Re-auth fresh

Middlewares + `/auth/reauth/*` endpoints; timestamps stamped on
every auth path; matrix wired into every mutating route
(security-mode, totp, passkey, recovery-code, change-password,
change-email, delete-self). The front uses
`freshenPasswordReauth` (no `proofLoginToken` embedded in
bodies).

The matrix (§6) requires "fresh re-auth < 5 min". Implementation:

- `requireFreshPassword` middleware: checks
  `session.reauth_password_at >= now() - 5min`. Otherwise 401 with
  `reauth_required: 'password'`.
- `requireFreshPasswordOrPasskey`: checks one OR the other.
- Dedicated re-auth routes:
  - `POST /auth/reauth/password` → OPAQUE login lite, updates
    `reauth_password_at` on the current session.
  - `POST /auth/reauth/passkey` → WebAuthn assertion, updates
    `reauth_passkey_at`.
- `reauth_*_at` expires at logout, change-password, security-mode
  change.

### 5.4 Revocation

- **Logout** (`DELETE /auth/sessions/current`): delete the session
  row.
- **Logout all** (`DELETE /auth/sessions/all`): delete every
  session for this user, including the current one.
- **Change password**: *full ID rotation* — delete every session
  for this user (current included), insert a fresh session, issue
  a new signed cookie. Anti session-fixation.
- **Change security mode** (any kind): same rotation as
  change-password (delete all, fresh session, new cookie).
- **Applied MFA bypass**: delete every session except the current
  one (just promoted from mfa_pending). Forces re-enrollment of
  the bypassed factor before another session anywhere else.
- **Account deletion**: DB cascade (every session goes with).

---

## 6. Re-auth matrix

| Operation | Fresh re-auth (< 5 min) | Notes |
|---|---|---|
| Change `security_mode` | password | Other sessions are revoked |
| Add a passkey | password | |
| Remove a passkey | password | |
| Enable TOTP | password | |
| Disable TOTP | password | Forbidden from a session protected *by* the mode itself without re-auth |
| Regenerate TOTP backup codes | password | |
| Regenerate KEK recovery code | password | Invalidates the previous `wrapped_kek_recovery` |
| Change password | password **OR** passkey | Password is the only factor changeable via an alternative factor |
| Change email | password | Triggers OPAQUE re-register + email re-verification |
| Delete account | password **AND** (passkey if enabled) **AND** (TOTP if enabled) | Confirmation by typed phrase |
| Reveal recovery code | **N/A**: not supported in V1 | Code generated once at signup, never re-shown |
| Start a TOTP bypass | password (not fresh — direct OPAQUE login) | This is the "I lost my TOTP" screen on `mfa_pending` |
| Current logout | none | |
| Logout every session | password | |
| List sessions | full session | No re-auth |

**Underlying logic**:

> *Any change to the security policy = password (the most durable
> factor and the one you don't forget even with rare use); the
> password itself is the only thing that can be changed via an
> alternative factor (because that's what you do when you've
> forgotten it).*

### 6.1 Mode activation and downgrade rules

| Mode | Activation requires | Auto downgrades to |
|---|---|---|
| `password_or_passkey` | Always available (default) | — |
| `always_2fa` | At least one 2nd factor available: TOTP enabled (`mfa_totp.enabled_at IS NOT NULL`) **OR** ≥ 1 passkey enrolled (any kind, issue #72 made both acceptable at login) | `password_or_passkey` when **both** factors disappear (TOTP disabled/bypassed **AND** last passkey removed/bypassed) |
| `maximum` | TOTP enabled **AND** at least one PRF-capable passkey enrolled | `password_or_passkey` if TOTP disabled/bypassed OR last PRF passkey removed/bypassed |

**Server-side**, `POST /auth/security-mode/change` validates
eligibility before accepting the switch. Requested mode without
the required factors → 400 with a clear message:
- `400 second_factor_required`: "Enable TOTP or enrol a passkey
  before choosing always_2fa mode."
- `400 totp_required`: "Enable TOTP before choosing maximum mode."
- `400 passkey_required`: "Enrol a PRF-capable passkey before
  choosing maximum mode."

**Downgrade is applied in the same transaction** as the factor
removal (TOTP disable, last passkey removed/bypassed). Systematic
notification email: "Your security mode was lowered to <mode>
because <reason>."

### 6.2 Recovery on factor loss

Policy: **one factor lost = recoverable, two factors lost
simultaneously = destructive reset (data loss)**.

| Lost factor | Recovery path | Conditions |
|---|---|---|
| Password | KEK recovery code (cf. §7.7) | Need to know the recovery code |
| TOTP | 7-day email bypass (cf. §7.8) | Password OK + (passkey OK if `maximum` mode, or if `always_2fa` mode AND a passkey is enrolled) |
| Passkey (the last one) | 7-day email bypass (cf. §7.8) | Password OK + (TOTP OK if `maximum` mode, or if `always_2fa` mode AND TOTP is enabled) |
| Recovery code | Regenerate from Settings (password re-auth) | Account still accessible |
| 2 simultaneous factors (passkey + TOTP, password + passkey, etc.) | **Destructive reset only** (cf. §7.9) | Data lost, the user is warned |

**Enforcement**: §7.8 refuses to start a bypass if the **other**
factor required by the current mode isn't verifiable. That's what
makes "lost 2 = locked out" by construction.

---

## 7. Full flows

The detail of each flow lives in its own file under
[`docs/auth/`](./auth/) — one file per flow rather than one 880-line
monolith. Each file covers the sub-flows and edge cases; what
follows is just an index.

| Flow | File |
|---|---|
| 7.1 Register — single form + activation magic link | [`auth/Register.md`](./auth/Register.md) |
| 7.2 Login password-first | [`auth/Login.md`](./auth/Login.md) |
| 7.3 Login passkey-first | [`auth/Login.md`](./auth/Login.md) |
| 7.4 Stepped MFA — finalisation | [`auth/Login.md`](./auth/Login.md) |
| 7.5 Change password | [`auth/ChangePassword.md`](./auth/ChangePassword.md) |
| 7.6 Change email (partial design) | [`auth/ChangeEmail.md`](./auth/ChangeEmail.md) |
| 7.7 Recovery via KEK code | [`auth/Recovery.md`](./auth/Recovery.md) |
| 7.8 MFA factor bypass by email | [`auth/BypassMfa.md`](./auth/BypassMfa.md) |
| 7.9 Destructive reset | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |
| 7.10 Logout | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |
| 7.11 Account deletion | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |

The next sections (§8 TOTP, §9 Passkey, §10 Email service, etc.)
cover components consumed by several flows and stay in this file.

---

## 8. TOTP — details

> Code: routes `packages/api/src/routes/auth-totp.ts` (enroll /
> disable / regenerate) + `packages/api/src/routes/auth-mfa.ts`
> (verify-step + passkey-as-second-factor) +
> `packages/api/src/routes/auth-security-mode.ts` (mode change).
> Dedicated Settings page `/totp` (QR + masked key + eye/copy +
> inline verify) and `/login/mfa` page (stepped MFA with TOTP then
> passkey). The dismissable amber sidebar tip prompts the user to
> enable TOTP while `totpEnabled === false`. Backup codes:
> 10 × 120 bits / 24 base32 chars, single-use enforced by
> `UPDATE … WHERE used_at IS NULL`.

### 8.1 Frozen parameters

| Param | Value | Justification |
|---|---|---|
| Algo | SHA1 | RFC 6238, universal compat (Authy, Google Auth, etc.) |
| Digits | 6 | Standard |
| Period | 30s | Standard |
| Secret | 20 random bytes | RFC recommends min 20 bytes |
| Skew accepted | ±1 window (30s before/after) | Enough for typical clocks |
| Anti-replay | `last_window` | Refuses `window <= last_window` |
| Backup codes | 10, 130 bits, base32 (26 chars), SHA-256 hashed | Single-use |

### 8.2 Enrollment

`POST /auth/totp/enroll/start`

Preconditions: `requireFreshPassword` (from Settings) **OR** a
register session with `register_state = 'recovery_set'` (step 5
of the signup journey, cf. §7.1).

Server:
1. Generates a 20 random byte secret.
2. INSERT `mfa_totp { user_id, secret, enabled_at: NULL }` (or
   UPDATE if pending).
3. Generates 10 backup codes (130 bits each), hashes SHA-256,
   INSERT into `mfa_totp_recovery_codes`.
4. Response:
   ```json
   {
     "secret_base32": "JBSWY3DPEHPK3PXP",
     "otpauth_uri": "otpauth://totp/Nodea?secret=...&algorithm=SHA1&digits=6&period=30",
     "backup_codes": ["xxxx-xxxx-xx", ...]
   }
   ```

   `otpauth` label = `Nodea` (no email, no user_id — minimalist,
   avoids any leak via authenticator-app screenshots). Accepted
   consequence: if the user has several Nodea accounts in the same
   authenticator, the entries aren't distinguished by the label.

`POST /auth/totp/enroll/verify`

Body: `{ code: "123456", backup_codes_acknowledged: true }`.

Server:
1. Verifies the TOTP code with the pending secret.
2. Refuses if `backup_codes_acknowledged !== true`.
3. UPDATE `mfa_totp.enabled_at = now()`,
   `mfa_totp.last_window = current_window`.
4. Response `200 { enabled_at }`.

### 8.3 Verification

`POST /auth/mfa/totp/verify`

Body: `{ code: "123456" }`.

Server:
1. Loads `mfa_totp` (refuses if `enabled_at IS NULL`).
2. Computes TOTP for windows `[current-1, current, current+1]`.
3. Compares constant-time.
4. On match:
   - `last_window = matched_window` (anti-replay).
   - `mfaTotpVerified = true` on the pending session.
5. Otherwise: try the backup codes.

`POST /auth/mfa/totp/verify-backup`

Body: `{ code: "xxxx-xxxx-xx" }` (the user can enter a backup
code in the same field — UI distinguishes by format).

Server:
1. SHA-256 hash.
2. SELECT FROM `mfa_totp_recovery_codes WHERE user_id = $1 AND
   code_hash = $2 AND used_at IS NULL`.
3. If found: `used_at = now()` (single-use).
4. `mfaTotpVerified = true`.
5. If every backup code is used: email "You used your last backup
   code. Regenerate new ones in Settings."

### 8.4 Disable

`POST /auth/totp/disable`: `requireFreshPassword`.

Server: `enabled_at = NULL`, DELETE backup codes. If
`security_mode in ('always_2fa', 'maximum')` → switches mode to
`password_or_passkey` automatically (and notification email).

### 8.5 Backup-code regeneration

`POST /auth/totp/backup-codes/regenerate`:
`requireFreshPassword`.

Server: DELETE old, INSERT 10 new ones. Response with the codes
in cleartext (shown only once).

---

## 9. Passkey — details

> Code: routes `packages/api/src/routes/auth-passkey.ts`, client
> orchestrator `packages/web/src/core/auth/passkey-flow.ts`,
> dedicated Settings page `/passkeys` (and the "Passkey"
> SecuritySection in Account → Security). Dismissable amber
> sidebar tip prompts enrollment when `passkeysCount === 0`
> (consistent with the decision: no passkey at register, opt-in
> post-activation).
>
> **Known limitation**: authenticators that don't surface
> `prf.results.first` at registration are enrolled as login-only;
> the "promote-to-PRF" path via a calibration assertion will land
> in a later iteration.

### 9.1 Structural choices

- `userVerification: 'required'` (cf. §2.3). Any enrollment or
  auth attempt without a gesture is refused by the browser or by
  the server in final validation.
- `attestation: 'none'` — we don't request hardware attestation.
  No vendor tracking.
- `authenticatorSelection.residentKey: 'preferred'` — allows
  discoverable credentials (login without email).
- `pubKeyCredParams: [{type: 'public-key', alg: -7}, // ES256
  {type: 'public-key', alg: -257}]` // RS256.
- PRF extension enabled: `extensions: { prf: { eval: { first:
  PRF_INPUT_FIXED } } }`.

### 9.2 Enrollment

`POST /auth/passkeys/enroll/start`

Preconditions: `requireFreshPassword` (or register journey
step 6).

Server:
1. Generates a 32 random byte challenge.
2. Stores on the current session: `pending_webauthn_challenge` +
   `pending_webauthn_challenge_at = now()`. 5 min TTL validated at
   `/finish` time (refuses if `now() - challenge_at > 5min`). No
   Redis in V1.
3. Returns WebAuthn `PublicKeyCredentialCreationOptions`.

Client:
1. `navigator.credentials.create(options)`.
2. Captures `prf_output` if supported
   (`getClientExtensionResults().prf.results.first`).
3. If PRF supported: derives `wk_passkey = HKDF(prf_output,
   "nodea:wrap-kek")`, wraps the existing KEK (which the client
   has in memory after a recent login or in-progress register):
   `wrapped_kek = AES-GCM(wk_passkey, kek,
   AAD=users.id||"passkey"||credential_id)`.
4. POST `/auth/passkeys/enroll/finish` with:
   - WebAuthn attestation response
   - `prf_supported: bool`
   - `wrapped_kek` + IV (if PRF)
   - `label: string` (user-facing)

Server:
1. Verifies the attestation (challenge match, signature OK).
2. INSERT `auth_factors { kind: 'passkey', credential_id,
   public_key, sign_count, transports, prf_supported,
   wrapped_kek?, wrapped_kek_iv?, label }`.
3. If `prf_supported = false` and it's the **only** configured
   passkey → display a clear UI warning: "This passkey can't
   alone decrypt your data. You'll still need your password or
   another PRF-capable passkey. Continue?".

### 9.3 UV `'required'` — passkeys without a gesture refused

A passkey is only useful when a gesture (PIN, biometric, manager
unlock) proves the user's presence **on top of** device possession.
Without it, plain hardware theft suffices to unlock the account
and decrypt the KEK — an angle that invalidates the whole rest of
the model.

**V1 decision**: `userVerification: 'required'` for both
enrollment and authentication. The server validates
`authData.flags.uv === true` on every assertion. 400 refusal
otherwise.

At enrollment time, the browser itself refuses authenticators
that don't support UV (or don't have it configured — for a
Yubikey, it offers PIN setup). UI text:

> **A passkey must be able to ask you for a PIN, fingerprint, or
> FaceID.** If you use a hardware key (Yubikey, etc.) without a
> PIN configured, configure the PIN before continuing.

Accepted authenticators:
- Bitwarden, 1Password, iCloud Keychain, Google Password Manager
  (UV = manager unlock);
- TouchID, FaceID, Windows Hello, Android biometric;
- Yubikey / Solokey / Titan **with PIN configured**.

Refused authenticators:
- Yubikey in pure-touch mode (no PIN);
- Any authenticator without a gesture.

### 9.4 Login & PRF

Cf. §7.3.

**Non-PRF case**:
- The authenticator doesn't support the PRF extension.
- Enrollment stored `prf_supported = false`, `wrapped_kek = NULL`.
- At login, signature OK = `mfa_passkey_verified = true`. But the
  client cannot derive the KEK from this passkey.
- Consequence: needs **either** the OPAQUE password on top
  (chained password login after passkey), **or** another PRF
  passkey.
- The UI must guide clearly: "This passkey validates your identity
  but can't alone decrypt your data. Type your password to
  continue."

### 9.5 Fixed PRF input

```ts
const PRF_INPUT_V1 = new Uint8Array([
  0x6e, 0x6f, 0x64, 0x65, 0x61, 0x3a, 0x70, 0x72, 0x66, 0x2d, 0x76, 0x31,
  // zero padding to 32 bytes
  ...new Uint8Array(20)
]);
// "nodea:prf-v1" + zero-padding
```

Versioned (`v1`) in case we want to pivot in the future. Any
rotation = re-wrap the KEKs under the new PRF outputs.

### 9.6 Signature counter

WebAuthn provides a `signCount`. If an assertion arrives with
`signCount <= stored_signCount` **and**
`auth_factors.sign_count_strict = true`, that's suspicious
(credential clone). Action: refuse the login + alert email.

Exception: some authenticators (Apple notably) don't maintain the
counter — `signCount` stays at 0. Heuristic: on 3 consecutive
valid assertions with `signCount = 0`, the server flips
`auth_factors.sign_count_strict = false` for that specific
credential. From then on, the signCount check is disabled
**only** for that credential.

The `signCountStrict` column (cf. §4.1) is `true` by default at
enrollment and never re-armed (a credential that flips to `false`
stays there).

### 9.7 Add/remove

`GET /auth/passkeys/list`: list of credentials with `label`,
`created_at`, `last_used_at`, `prf_supported`, `transports`.

The Settings UI must **visually distinguish** PRF-capable
passkeys (badge "decrypts your data") from login-only ones
(badge "login only, doesn't decrypt your data"). This distinction
is critical so the user understands why `maximum` mode may be
unavailable: it requires at least one PRF-capable passkey. The
list also shows a "X PRF-capable passkey(s) enrolled" counter at
the top.

`POST /auth/passkeys/:id/remove`: `requireFreshPassword`. DELETE
row in a transaction that includes the auto downgrade:

- If `count(auth_factors WHERE kind='passkey' AND prf_supported=true)
  == 1` (this delete removes the last PRF-capable passkey)
  **and** `users.security_mode = 'maximum'` → switch
  `users.security_mode = 'password_or_passkey'` in the same
  transaction.
- Notification email: "Your security mode dropped to
  `password_or_passkey` because you removed your last PRF-capable
  passkey."

V1 = auto downgrade, **never a 400 refusal**. The user always
keeps control over deleting their passkeys; the security mode
adjusts automatically.

---

## 10. Email service

### 10.1 Interface

```ts
// packages/api/src/services/email.ts

export interface EmailService {
  send(params: {
    to: string;
    subject: string;
    text: string;       // text version mandatory
    html?: string;      // HTML version optional
    tag?: string;       // for logs: 'verify-register', 'totp-bypass-confirm', etc.
  }): Promise<void>;
}
```

### 10.2 Implementations

| Env | Impl | Behaviour |
|---|---|---|
| `dev` (recommended) | `SmtpEmailService` pointing at **Mailpit** | Real SMTP transport to the `mailpit` container of the `dev` compose-profile. Emails visible at `http://localhost:8025`, nothing leaves the machine. Lets you test the **real SMTP path** (rendered templates, encoding, multipart) instead of a log. |
| `dev` (fallback) | `ConsoleEmailService` | Logs JSON to stdout. Useful when running `pnpm dev` bare-metal without Docker (and therefore without Mailpit). Otherwise avoid. |
| `test` | `RecordingEmailService` | In-memory store, exposed via Vitest fixtures. |
| `prod` | `SmtpEmailService` | nodemailer + Infomaniak SMTP. Credentials via `SMTP_*` env vars (sourced from Infisical at deploy). Cf. §13.1. |

The impl is selected by `EMAIL_SERVICE_IMPL` (`smtp` / `console` /
`recording`). For dev, the default is **`smtp`** combined with
`SMTP_HOST=mailpit` (in Docker) or `SMTP_HOST=127.0.0.1` +
`SMTP_PORT=1025` (from the host).

### 10.3 Templates

All in French + UTF-8. Stored in
`packages/api/src/services/email/templates/`.

| Template | Use |
|---|---|
| `verify-register.txt` | Activation code at signup |
| `verify-email-change.txt` | Verification code at email change |
| `totp-bypass-confirm.txt` | Confirm + cancel links for TOTP bypass |
| `totp-bypass-applied.txt` | Post-bypass notification |
| `password-reset.txt` | Destructive reset token (existing) |
| `passkey-clone-detected.txt` | signCount alert |
| `last-backup-code-used.txt` | Backup codes notification |

### 10.4 Anti-spam / rate-limit

Per-email rate-limits (default, env-tunable):
- `verify-register`: 3 / hour
- `verify-email-change`: 3 / hour
- `totp-bypass-confirm`: 1 / hour
- `password-reset`: 3 / hour

---

## 11. Server middlewares

### 11.1 List

| Name | Checks | Failure output |
|---|---|---|
| `loadSession` | Cookie + sessions row | 401 |
| `requireUser` | `loadSession` + `kind = 'full'` | 401 |
| `requireRegisterSession` | `kind = 'register'` | 401 |
| `requireMfaPending` | `kind = 'mfa_pending'` | 401 |
| `requireMigrate` | `kind = 'migrate'` | 401 |
| `requireFreshPassword` | `reauth_password_at > now-5min` | 401 `{ reauth_required: 'password' }` |
| `requireFreshPasswordOrPasskey` | one OR the other | 401 `{ reauth_required: 'password_or_passkey' }` |
| `requireAdmin` | `requireUser` + `users.is_admin` | 403 |
| `rateLimit(opts)` | Per-IP/email rate-limit | 429 |

### 11.2 Composition

Each route declares its prerequisites:

```ts
// packages/api/src/routes/auth.ts
const route = createRoute({
  method: 'post',
  path: '/auth/totp/enroll/start',
  middleware: [requireUser, requireFreshPassword],
  // ...
});
```

### 11.3 Reauth fresh — UX

When a middleware refuses for missing re-auth, the front intercepts
the `reauth_required` and shows a modal:
- `password` → single password field → POST `/auth/reauth/password`.
- `password_or_passkey` → "Re-auth password" / "Re-auth passkey"
  buttons.

After success, the original request is automatically retried.

---

## 13. Frozen algorithms & parameters

(Recap table. Any change to these parameters requires a dedicated
PR + this section's revision + a rotation plan.)

| Domain | Parameter | Value |
|---|---|---|
| OPAQUE | library | `@serenity-kit/opaque` (Rust + WASM, audited Cure53) |
| OPAQUE | suite | OPAQUE-3DH-RISTRETTO255-SHA512-Argon2id (lib default) |
| OPAQUE | Argon2 m | 64 MiB |
| OPAQUE | Argon2 t | 3 |
| OPAQUE | Argon2 p | 4 |
| HKDF | hash | SHA-256 |
| HKDF labels | `nodea:wrap-kek` | derive a wrapping key from a factor |
| HKDF labels | `nodea:wrap-main` | derive the wrapping key for the main key from the KEK |
| HKDF labels | `nodea:aes` | module AES sub-key (existing) |
| HKDF labels | `nodea:hmac` | HMAC guards sub-key (existing) |
| AES-GCM | key size | 256 bits |
| AES-GCM | IV size | 96 bits, random per encryption |
| AES-GCM | tag size | 128 bits |
| HMAC | hash | SHA-256 |
| TOTP | algo | SHA1 |
| TOTP | digits | 6 |
| TOTP | period | 30 s |
| TOTP | secret size | 20 bytes |
| TOTP | skew | ±1 window |
| KEK recovery code | entropy | 128 bits (12 BIP39 words = 132 bits including 4 of checksum) |
| KEK recovery code | encoding | BIP39 12 words (standard English wordlist) |
| TOTP backup codes | count | 10 |
| TOTP backup codes | entropy | 130 bits each |
| TOTP backup codes | hash storage | SHA-256 |
| WebAuthn | UV | `'required'` (enrollment + assertion) |
| WebAuthn | rpId | from env `WEBAUTHN_RP_ID`, prod default `nodea.app` |
| WebAuthn | attestation | `'none'` |
| WebAuthn | algos | ES256 (-7), RS256 (-257) |
| WebAuthn | PRF input v1 | `"nodea:prf-v1"` + zero-padding 32 bytes |
| Cookie | full session TTL | 7 days fixed (no slide) |
| Cookie | rate-limit storage | in-process RAM (V1 single-instance) |
| Cookie | mfa_pending TTL | 5 min |
| Cookie | register TTL | 24 h |
| Cookie | reauth fresh window | 5 min |
| Email verification code | digits | 6 |
| Email verification code | TTL | 10 min |
| Email verification code | max attempts | 5 |
| TOTP bypass | actual delay | 7 days after confirmation |
| TOTP bypass | request TTL | 7 days |
| Password policy | zxcvbn min score | 3 |
| Password policy | min length | 8 |
| Rate limits | `/auth/register/*` | 5/h IP, 3/h email |
| Rate limits | `/auth/login/*` | 10/min IP, 20/h email |
| Rate limits | `/auth/migrate/*` | 10/min IP, 20/h email (aligned with login) |
| Rate limits | `/auth/recover-kek/*` | 5/h IP, 3/h email (130 bits BIP39 already protect from brute-force) |
| Rate limits | `/auth/mfa/*` | 5/min session |
| Cooldown | change-email (between changes) | 7 days |

### 13.1 Environment variables

Every secret and infra-specific deploy parameter goes through env
vars (or Infisical). **None** of these values are hardcoded in
application code.

| Variable | Use | Example / default |
|---|---|---|
| `WEBAUTHN_RP_ID` | WebAuthn rpId (origin tied to passkeys) | `nodea.app` |
| `WEBAUTHN_RP_NAME` | User-facing RP name | `Nodea` |
| `WEBAUTHN_ORIGIN` | Origin expected in assertions | `https://nodea.app` |
| `OPAQUE_SERVER_SETUP` | Server static setup (output of the lib's `server.setupServer()`) | base64 |
| `COOKIE_SECRET` | Cookie signing, ≥ 32 chars | random base64 |
| `SMTP_HOST` | SMTP server (Infomaniak) | `mail.infomaniak.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP user | from Infisical |
| `SMTP_PASS` | SMTP password | from Infisical |
| `SMTP_FROM` | From address | `noreply@nodea.app` |
| `SMTP_FROM_NAME` | From name | `Nodea` |
| `EMAIL_SERVICE_IMPL` | Impl choice: `console` / `recording` / `smtp` | `console` in dev, `smtp` in prod |
| `DATABASE_URL` | Postgres | `postgres://...` |
| `RATE_LIMIT_DRIVER` | `memory` (V1) / `redis` (future) | `memory` |
| `HSTS_ENABLED` | Enables `Strict-Transport-Security` header | `true` in prod |
| `HSTS_MAX_AGE` | HSTS header `max-age`, in seconds | `31536000` (1 year) |
| `HSTS_INCLUDE_SUBDOMAINS` | Includes subdomains | `true` |
| `HSTS_PRELOAD` | Eligible for HSTS preload list | `false` (V1, enable after domain stabilisation) |

**Rule**: any new infra config adds a row here **and** an entry in
`.env.example` (without sensitive values).

**Source of secrets in prod**: Infisical → `.env` at deploy time.
The repo never contains credentials, nor a committed `.env` file.

### 13.2 Background tasks (cleanup)

#### ✅ V1 shipped

A single job: `cleanup-unactivated-accounts`, scheduled via
`node-cron` at **03:00 every Monday (UTC, container TZ)**, in the
API process. Cf. `packages/api/src/cron/index.ts` —
`startCronScheduler()` is called from `index.ts` at startup.

| Target | Purge condition | Why |
|---|---|---|
| `email_verifications` `kind='register'` | `expires_at < now()` | Expired activation tokens, frees the table |
| `users` `email_verified_at IS NULL` | no `email_verifications` pending left | Inactive accounts whose 7-day window elapsed. CASCADE removes consumed sessions / email_verifications along the way |
| `sessions` | `expires_at < now()` | Permanently expired sessions |

The job logs a summary on stdout:
```
[cron] cleanup-unactivated done {"verifications":N,"users":N,"sessions":N}
```

On error, the job logs and skips — orphan data costs less than a
buggy delete. No admin trigger endpoint in V1 (to add when needed).

#### 🚧 Phase 2+

When TOTP / passkey / MFA bypass land, add to the same job:

| Target | Purge condition |
|---|---|
| `mfa_bypass_requests` | (`cancelled_at`, `consumed_at`, or `expires_at`) `< now() - 30d` (audit window) |
| Email verifications with `attempts >= 5` | immediately (forces re-request) |
| `email_verifications` `kind='email_change'` consumed or expired | `> 7d` |

---

## 14. Forbidden anti-patterns

> This list complements the "Checklist crypto pour les devs" in
> [`tech.md`](../packages/web/src/app/pages/docs/content/tech.md)
> with the **auth-specific** rules (sessions, MFA, backup codes,
> AAD, auth-log redaction). Generic rules (HKDF, no-key-material-
> at-rest, no-leak-of-guard) live in tech.md; the two lists never
> contradict each other.

To copy into PR checks or custom linters:

1. **NEVER** log an `export_key`, `prf_output`, `recovery_code`,
   `kek`, `main_key`, `wrapped_*`, **TOTP secret**. Not in dev.
   Not in debug. Not at logger `trace` level.
2. **NEVER** store a factor or the KEK in localStorage,
   sessionStorage, IndexedDB, or window.*.
3. **NEVER** put the KEK or the main key back on the wire (that's
   the whole point of E2E).
4. **NEVER** import the same raw bytes under two different
   primitives (HKDF before import mandatory, distinct labels).
5. **NEVER** forget the AAD in an `AES-GCM(...)`. Empty ≠ absent —
   the code must refuse to encrypt/decrypt without an explicit AAD
   (no overload omitting that parameter).
6. **NEVER** wrap the TOTP secret. It must be in cleartext on the
   server.
7. **NEVER** expose an endpoint that reveals:
   - The `recovery code` (never re-displayable).
   - The TOTP secret (recovery = new enrollment).
   - Backup codes in cleartext (except at regeneration).
   - Another user's `wrapped_kek_*` or `encrypted_key`.
8. **NEVER** use `users.email` as a PK. PK = `users.id` UUID,
   immutable.
9. **NEVER** disable a 2FA from a session protected by that
   factor without a fresh password re-auth. The matrix is
   inviolable.
10. **NEVER** issue a full session without going through
    `mfa_pending` when `security_mode != password_or_passkey`.
11. **NEVER** validate a TOTP code without bumping `last_window`.
12. **NEVER** validate a backup code without marking `used_at`.
13. **NEVER** use `==`/`!=` on hashes or tokens. Always
    constant-time comparison (`crypto.timingSafeEqual`).
14. **NEVER** build a SQL string by concatenation. Always Drizzle
    `eq()` etc.
15. **NEVER** return `guard`, `wrapped_*`, `secret` (TOTP),
    `code_hash` (backup) in an API response.
16. **NEVER** commit a "temporary" `if (env.NODE_ENV === 'development')
    console.log(secret)`. None.
17. **NEVER** add a silent `catch (e) {}` in a crypto function.
    If the failure is expected, comment the reason
    (e.g. `// stale blob on logout`).
18. **NEVER** log the body **or the response** of a mutating
    `/auth/*` route. The logger must apply **two** layers:

    **Layer A — per-route blacklist (path patterns)**:
    `["/auth/register/*", "/auth/login/*", "/auth/passkeys/*",
      "/auth/totp/*", "/auth/mfa/*", "/auth/migrate/*",
      "/auth/recover-kek/*", "/auth/change-password",
      "/auth/change-email/*", "/auth/security/*",
      "/auth/me/crypto"]`.
    Only `/auth/sessions` (list read) and `/auth/me` (profile
    without crypto, API-14 split) routes may log their bodies.
    `/auth/me/crypto` stays blacklisted — that's the route that
    transports the wrap blobs.

    **Layer B — field-level redaction (defense-in-depth)**: across
    **all** logger output, redact the following JSON keys:
    `["password", "current_password", "new_password",
      "code", "token", "secret", "envelope", "export_key",
      "prf_output", "wrapped_*", "recovery_*", "challenge",
      "signature", "credential_id", "code_hash", "*_hash"]`,
    with a `[REDACTED]` censor. This second layer protects even
    when a route forgets its Layer A blacklist, or when application
    code logs sensitive objects from elsewhere.
19. **NEVER** build an AES-GCM AAD other than via `buildAAD()`
    from `@nodea/shared/crypto-types`. The linter / tests must
    fail loudly on any other usage.

---

## 15. Test matrix

Mandatory tests **before** merging each phase. Locations:

- Vitest unit: `packages/api/test/auth/**` and
  `packages/web/test/auth/**`.
- Vitest integration: `packages/api/test/integration/auth.test.ts`
  (with `testcontainers` PostgreSQL).
- Playwright: `packages/web/e2e/auth.spec.ts`.

### 15.1 Crypto unit tests

| Test | Scope |
|---|---|
| AES-GCM round-trip with AAD | unit |
| Distinct HKDF labels produce different keys | unit |
| `buildAAD([users.id, "password"])` is deterministic | unit |
| `buildAAD([a, b])` ≠ `buildAAD([a+b])` (length-prefix prevents collisions) | unit |
| `buildAAD([])` returns 0 bytes (degenerate case) | unit |
| `buildAAD` refuses a part > 65535 bytes (u16 limit) | unit |
| KEK wrap/unwrap under wk_password (fixed export_key) | unit |
| KEK wrap/unwrap under wk_passkey (fixed prf_output) | unit |
| KEK wrap/unwrap under wk_recovery (fixed recovery_code) | unit |
| KEK unwrap with wrong AAD fails | unit |
| KEK unwrap with wrong wrap blob fails | unit |
| Recovery proof matches expected value | unit |

### 15.2 OPAQUE integration

| Test | Scenario |
|---|---|
| OPAQUE register → login → unwrap main key → existing ciphertext readable | integration |
| Wrong password → server-side login fail (no leak) | integration |
| Stale session after change-password rejected | integration |
| OPAQUE handles unknown identifier without timing leak | integration |

### 15.3 Passkey integration

| Test | Scenario |
|---|---|
| Enroll PRF passkey → login passkey-first → KEK unwrap | integration |
| Enroll non-PRF passkey → login passkey-first → password fallback | integration |
| Multiple passkeys, removing one preserves the others | integration |
| signCount regression → login refused + email sent | integration |
| signCount = 0 on 3 consecutive assertions → `signCountStrict = false`, login OK | integration |
| After `signCountStrict = false`, signCount regression accepted | integration |
| Enrollment with `authData.flags.uv = false` → server 400 | integration |
| Login assertion with `authData.flags.uv = false` → server 400 | integration |
| Switch to `maximum` mode without TOTP enrolled → 400 `totp_required` | integration |
| Switch to `maximum` mode without passkey enrolled → 400 `passkey_required` | integration |
| Remove the last passkey in `maximum` mode → auto downgrade to `password_or_passkey` + email | integration |
| Disable TOTP in `maximum` mode → auto downgrade + email | integration |

### 15.4 TOTP integration

| Test | Scenario |
|---|---|
| Enrollment + verify → enabled_at set | integration |
| Replay (same code, same window) rejected | integration |
| Skew accepted at -30s, +30s; rejected at ±60s | integration |
| Backup code single-use | integration |
| Backup code rejected after use | integration |
| Last backup code → email sent | integration |
| Disable from a TOTP-protected session without re-auth → 401 | integration |
| Disable after password re-auth OK | integration |

### 15.5 MFA factor bypass (TOTP / passkey)

| Test | Scenario |
|---|---|
| TOTP request → email sent with confirm + cancel tokens | integration |
| Passkey request → email sent (different template) | integration |
| Confirm without 7 days → bypass refused | integration |
| Confirm + 7 days TOTP → bypass applied, `mfa_totp.enabled_at = NULL`, backup codes purged | integration |
| Confirm + 7 days passkey → every `auth_factors kind='passkey'` deleted | integration |
| Cancel during the window invalidates the request | integration |
| New request invalidates the previous one (across factors) | integration |
| TOTP bypass in `maximum` mode → auto downgrade to `password_or_passkey` | integration |
| Passkey bypass in `maximum` mode → auto downgrade to `password_or_passkey` | integration |
| Bypass applied → notification email | integration |
| **Multi-factor loss**: max mode, passkey AND TOTP unverified → bypass request `factor=totp` returns 409 `multi_factor_loss` | integration |
| **Multi-factor loss**: max mode, passkey AND TOTP unverified → bypass request `factor=passkey` returns 409 | integration |
| Passkey bypass started while a TOTP bypass is active → 409 `bypass_already_active` | integration |

### 15.6 Multi-step register

| Test | Scenario |
|---|---|
| Step 1 → email sent in dev console | integration |
| Step 2 wrong code → attempts++; 5 attempts → 410 | integration |
| Step 2 OK → register cookie issued | integration |
| Resume after browser close → correct step | integration |
| Expired register cookie → forces step 1 | integration |
| Step 7 finalize → full session cookie | integration |

### 15.7 KEK Recovery

| Test | Scenario |
|---|---|
| Valid recovery code → KEK unwrap + new password OK + recovery code regenerated | integration |
| Recovery code with invalid BIP39 checksum → client-side rejection (no server hit) | integration |
| `recovery_code_hash` mismatch on the server → 401, **no** mutation applied | integration |
| `recovery_code_hash` mismatch logged as `auth.recover.hash_mismatch` | integration |
| Regeneration in Settings → old `wrapped_kek_recovery` + old `recovery_code_hash` invalidated simultaneously | integration |
| Destructive reset → `wrapped_kek_recovery` + `recovery_code_hash` NULL | integration |
| `recovery_session_id` consumed only once | integration |
| `/start` on unknown email → opaque response indistinguishable from a known email (timing) | integration |

### 15.8 Re-auth matrix

| Test | Scenario |
|---|---|
| Change mode without re-auth → 401 reauth_required | integration |
| Change mode with fresh password re-auth → OK | integration |
| Change password with passkey re-auth → OK | integration |
| Change password without any re-auth → 401 | integration |
| Account deletion: password alone if no second factor | integration |
| Account deletion: password + passkey + TOTP if all configured | integration |

### 15.9 End-to-end Playwright

| Scenario | Description |
|---|---|
| `register-happy-path` | Step 1 → ... → step 7 → onboarding |
| `register-resume` | Step 3 → close browser → return → resumes step 4 |
| `login-password-first-mode-max` | password → passkey → TOTP → home |
| `login-passkey-first-mode-max` | passkey → password → TOTP → home |
| `bypass-totp-full-flow` | Lost TOTP → email confirm → 7 days pass → login skips TOTP → re-enrollment |
| `change-password-via-passkey` | login → settings → passkey re-auth → change password OK |
| `migration-legacy-user` | legacy login → migration prompt → set recovery code → home |

### 15.10 Coverage targets

- `packages/api/src/auth/**`: ≥ 90 %
- `packages/web/src/core/crypto/**`: ≥ 95 %
- `packages/shared/src/crypto-types.ts`: ≥ 95 %

---

## 16. Pitfalls recap

To keep visible at the top of every phase's PR:

1. **TOTP isn't a crypto factor.** It wraps nothing, unlocks
   nothing. It's a session slow-down, not a KEK guardian. A
   malicious server operator can bypass it.
2. **`export_key` is sensitive.** As sensitive as the KEK itself.
   Zero the bytes after use. Never persist.
3. **`prf_output` is sensitive.** Same.
4. **The `recovery code` is never stored in cleartext on the
   server.** The server stores `wrapped_kek_recovery` (blob
   undecryptable without the code) and `recovery_code_hash =
   SHA-256(entropy)` (uncrackable offline with 128 bits of BIP39
   entropy). The code itself is never persisted.
5. **The main key bytes don't change after signup.** Change-password
   = re-wrap KEK. Add-passkey = add a KEK wrap. Recovery = unwrap
   then re-wrap (the main key stays the same). Every existing
   ciphertext is protected by this immutability.
6. **AAD mandatory at every wrap/unwrap.** No default, no helper
   that omits it.
7. **Mode change requires fresh password re-auth.** No path
   bypassing the matrix — not even via admin API.
8. **OPAQUE id = email.** Changing the email = OPAQUE re-register.
   Heavy but consistent. The internal identifier `users.id` stays
   immutable.
9. **Only one mfa_bypass_request active at a time.** Conditional
   unique index.
10. **Passkeys without UV refused.** UV `'required'` enforced at
    enrollment and on every assertion. Yubikey without a
    configured PIN → enrollment refused.

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| **OPAQUE** | aPAKE (asymmetric Password-Authenticated Key Exchange) that lets a client prove knowledge of a password to the server without revealing the password or a crackable hash, and derive a shared `export_key`. RFC 9497. |
| **export_key** | 32-byte symmetric key derived by OPAQUE after successful authentication. Known only to the client. |
| **WebAuthn** | Standardised web API for FIDO2. Enables auth via passkeys (cryptographic keys bound to an origin). |
| **PRF** | Pseudo-Random Function. WebAuthn extension that lets the authenticator produce a deterministic output from a client-supplied input. Used here to derive a wrapping key without sending sensitive material to the server. |
| **prf_output** | Output of the PRF extension. Typically 32 bytes. Known only to the client (never transmitted to the server). |
| **TOTP** | Time-based One-Time Password. RFC 6238. |
| **KEK** | Key Encryption Key. Here, a 32-byte random key wrapping the main key. Itself wrapped by each factor. |
| **Main key** | 32-byte random key generated at signup. Crypto source of truth for the AES and HMAC sub-keys. Never changes. |
| **Sub-keys (aes_main, hmac_main)** | Derived via HKDF from main_key, imported non-extractable in WebCrypto. |
| **AAD** | Additional Authenticated Data. Data authenticated by AES-GCM but not encrypted. Binds a blob to its context. |
| **HKDF** | HMAC-based Key Derivation Function. RFC 5869. |
| **KEK recovery code** | High-entropy code (~130 bits) generated when the user configures the recovery code (a strongly recommended post-signup step), shown only once. Derives a wrapping key that wraps the KEK. |
| **TOTP backup codes** | 10 single-use codes generated at TOTP enrollment, server-hashed, in case the authenticator is lost. |
| **TOTP bypass** | Recovery mechanism for TOTP + backup-codes loss. Email + 7-day delay. |
| **Stepped MFA** | Two-phase login: primary factor (OPAQUE password or passkey) → pending cookie → additional factors → full cookie. |

