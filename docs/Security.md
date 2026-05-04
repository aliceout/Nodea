# Security

Architecture of the E2E crypto model as of the close of the `refacto`
migration cycle. This replaces the PocketBase-era version; every
paragraph below describes code that exists today in the repository.

---

## 1. Guiding principles

- **End-to-end encryption.** Every user-owned record ships to the API
  already encrypted. The server stores opaque blobs
  (`cipher_iv`, `payload`) and the technical metadata required to route
  the request (`user_id`, `module_user_id`, `guard`, timestamps).
  Announcements are the single intentional exception (see Database.md).
- **Random main key.** At register time the client generates 32 random
  bytes. The raw key is never transmitted; it is wrapped under a KEK
  derived from `password + encryption_salt` via **Argon2id** and stored
  as `users.encrypted_key`. The server can read that blob but cannot
  decrypt it.
- **HKDF domain separation.** The raw main key is stretched into two
  distinct sub-keys before import into WebCrypto:
  - `aesKey` — HKDF label `"nodea:aes"`, AES-256-GCM, `encrypt`/`decrypt`.
  - `hmacKey` — HKDF label `"nodea:hmac"`, HMAC-SHA-256, `sign`.
  The same raw bytes are **never** imported under both primitives. See
  [`packages/web/src/core/crypto/key-material.ts`](../packages/web/src/core/crypto/key-material.ts).
- **Non-extractable CryptoKey.** Both derived keys are imported with
  `extractable: false` and live only in memory. They are cleared at
  logout and cannot be re-exported for logging or local persistence.
- **Branded types.** `AesMainKey`, `HmacMainKey`, `Base64`, `CipherIV`,
  `EncryptedBlob` from `@nodea/shared/crypto-types` prevent mixing
  primitives at compile time.
- **Session coherence.** Any decrypt failure flips the Zustand crypto
  slice to `'missing'`, the `KeyMissingModal` blocks the layout, and
  the only escape is logout + re-login (which re-derives the main key
  from the password).

---

## 2. Encrypted records

Every `<module>_entries` row has the shape:

| Column           | Role                                                     |
| ---------------- | -------------------------------------------------------- |
| `user_id`        | Server-side ownership anchor. FK with CASCADE.           |
| `module_user_id` | Opaque per-module sub-identifier (sid). Client-generated. |
| `cipher_iv`      | 96-bit AES-GCM IV, base64.                               |
| `payload`        | Base64 AES-GCM ciphertext of the decrypted JSON payload. |
| `guard`          | HMAC-SHA-256 digest. Never returned in reads.            |
| `created_at` / `updated_at` | Server-side timestamps.                          |

The API response strips `guard` on reads. Update and delete take the
sid + guard as **request headers** `X-Sid` and `X-Guard` — never as
query parameters — so the HMAC guard never lands in `hono/logger()`,
nginx access logs, or browser referrers (SEC-01). The server compares
the header against the stored row and never learns the main key.

---

## 3. HMAC guards

```text
guard = "g_" + hex( HMAC(hmacKey, `${module_user_id}:${record_id}`) )
```

- **Two-phase creation.** On `POST /<collection>/records` the client
  sends `guard: "init"` (it doesn't know the record id yet). The
  server returns the `id`; the client immediately `PATCH`es with
  headers `X-Sid: <sid>`, `X-Guard: init` and the real `guard` in
  the body, and the server promotes.
- **Update / delete** require headers `X-Sid: <module_user_id>` and
  `X-Guard: <guard>`. The server does a constant-time compare against
  the stored guard and rejects on mismatch. **Headers, not query
  params** — query strings would be logged by `hono/logger()` and
  nginx access logs, and the guard IS crypto material derived from
  the main key (CLAUDE.md §Error handling forbids logging it).
- **Deterministic.** No cache, no network. Losing the main key means
  losing the ability to mutate any existing record.

The 1:1 tables (`modules_config`, `user_preferences`) skip the guard:
there is no record id to authenticate, the user *is* the record, and
`requireUser` + `user_id` scoping is sufficient.

---

## 4. Server-side protections

- **Argon2id** password hashing via `@node-rs/argon2`. Login verifies
  even on unknown email (dummy hash) to keep timing constant.
- **Parametrised queries** everywhere — Drizzle's `eq(x.field, value)`
  etc. No string concatenation.
- **Rate limits** on every `/auth/*` endpoint (and a few non-auth
  ones — see §5.1). Fixed-window, in-process memory, keyed on the
  first `x-forwarded-for` hop (or `x-real-ip`, then `unknown` as
  last fallback). Single-instance only — when scaling out, move
  the bucket store to Redis. Implementation in
  `packages/api/src/middleware/rate-limit.ts`.
- **Invite atomicity**: `SELECT … FOR UPDATE` inside a transaction
  guarantees each code is consumed at most once.
- **Session cookies**: HttpOnly, Signed (`COOKIE_SECRET`, min 32
  chars), `SameSite=Lax`, `Secure` in prod. Revoked via
  `DELETE FROM sessions`.
- **Admin endpoints** stack `requireAdmin` on top of `requireUser`
  (403 for non-admins). An admin cannot delete their own account via
  `/admin/users/:id` — the route refuses `self.id === id`.
- **Response serialisation** never returns `guard` or another user's
  `encrypted_key`.
- **Surface lisible minimum sur les entry tables.** Le serveur
  ne peut pas linker une entrée à un user en plain SQL ni dater
  une écriture côté DB. Conséquence sécu : pas de cascade FK sur
  user delete — les entrées deviennent orphelines, illisibles
  sans la clé maîtresse. Self-delete est client-driven. Détails
  et rationale dans [`Modules.md §1`](./Modules.md#1-structure-commune).

### 4.1 Rate-limit table

Catalogue exhaustif des compteurs déclarés dans
`packages/api/src/routes/`. Le format est `max / fenêtre`. Tous
les compteurs sont keyed-IP (cf. `getClientKey` ci-dessus) et
indépendants les uns des autres — un même IP peut consommer
chaque limite séparément.

**Pré-auth (`/auth/*` accessibles sans cookie de session)**

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `POST /auth/register/start` | 10 / 1h | `register-start` | OPAQUE start, accepte 10 essais/heure pour permettre la correction d'erreurs sans ouvrir un boulevard à l'enrôlement automatisé |
| `POST /auth/register/finish` | 5 / 1h | `register-finish` | Étape coûteuse (création user + opaque_record + invite consumption en transaction) |
| `POST /auth/register/activate` | 20 / 1h | `register-activate` | Click sur le magic-link — tolérant à un user qui clique plusieurs fois |
| `GET  /auth/register/invite-info` | 30 / 1h | `register-invite-info` | Pré-rendu de l'écran de register (peeks au token sans le consommer) |
| `POST /auth/login` (legacy hashed) | 10 / 1min | `login` | Court-fenêtré pour limiter le brute-force, tolérant à un user qui se trompe |
| `POST /auth/login/start` + `/finish` | — | — | Pas de limiter dédié : OPAQUE est déjà coûteux côté serveur et `client.finishLogin` retourne `undefined` avant tout aller-retour réseau pour un mot de passe faux |
| `POST /auth/request-reset` | 5 / 1h | `request-reset` | Anti-spam mailer, 5 demandes par IP par heure suffisent à un user honnête |
| `POST /auth/reset` | 10 / 1min | `reset` | Mild cap pour ralentir un brute-force sur un token volé |
| `POST /auth/recover-kek/start` | 5 / 1h | `recover-kek` | Anti-énumération : 5 emails testés par heure max |
| `POST /auth/recover-kek/finish` | 5 / 1h | `recover-kek` | Partage le bucket avec `/start` |
| `POST /auth/mfa-bypass/confirm` | 20 / 1h | `mfa-bypass-link` | Click sur le magic-link de confirmation |

**Authentifié (cookie de session requis)**

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `POST /auth/reauth/password/{start,finish}` | 10 / 15min | `reauth` | Re-prove password gate (Phase 7B) — assez large pour les ré-auths légitimes, assez serré pour ne pas devenir un canal de devinette du mot de passe |
| `POST /auth/security-mode/change` | 10 / 15min | `security-mode-change` | Mutation sensible mais déjà gardée par re-auth — aucun raison d'en passer 100 |
| `POST /auth/mfa/totp` | 10 / 5min | `mfa-totp-verify` | Stepped-MFA après login : 10 tentatives par fenêtre 5min coupent le brute-force du code à 6 chiffres |
| `POST /auth/mfa/passkey/{options,verify}` | 10 / 5min | `mfa-passkey` | Stepped-MFA passkey : même logique, le challenge est de toute façon à usage unique côté serveur |
| `POST /auth/mfa-bypass/request` | 3 / 1h | `mfa-bypass-request` | Anti-spam : trois mails maximum par heure pour le bypass MFA |
| `POST /auth/totp/enroll/{start,verify}` | 10 / 15min | `totp-enroll` | Setup d'un nouveau secret — utilisé une fois en pratique |
| `POST /auth/totp/{disable,…}` | 30 / 15min | `totp-manage` | Lecture/écriture régulière depuis Settings, plafond confortable |
| `POST /auth/security/recovery-code` | 5 / 1h | `recovery-code-setup` | Setup ou regenerate du code de récupération — opération rare |
| `POST /auth/passkeys/enroll/{options,finish}` | 10 / 15min | `passkey-enroll` | Setup d'un nouveau passkey, idem TOTP |
| `POST /auth/passkeys/{login-options,login-finish}` | 20 / 15min | `passkey-login` | Login passkey-first : tolérant aux annulations utilisateur sur le prompt OS |
| `*    /auth/passkeys/:id/...` (rename, remove) | 30 / 15min | `passkey-manage` | Lecture/écriture Settings |

**Non-auth (lookup externes)**

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `GET /library/lookup/isbn/:isbn` | 30 / 1min | `library-lookup-isbn` | Proxy ISBN — protège l'API tierce |
| `GET /library/lookup/query` | 30 / 1min | `library-lookup-query` | Recherche fuzzy |
| `GET /library/lookup/cover/:hash` | 60 / 1min | `library-lookup-cover` | Couvertures d'images, ratio plus haut car appelé en batch sur une page de résultats |

**Politique implicite.** Trois familles de durée :
- **5 min** pour les codes courts (TOTP, passkey en stepped-MFA) —
  borne le brute-force d'un secret 6 chiffres.
- **15 min** pour la gestion sensible (re-auth, security-mode,
  enroll d'un facteur).
- **1 h** pour les actions à coût mailer ou à coût serveur élevé
  (register, reset, recovery, bypass).

Si tu ajoutes une nouvelle route `/auth/*`, choisis la fenêtre
selon ces familles plutôt que d'inventer une nouvelle valeur ; les
exceptions doivent être justifiées en commentaire au-dessus du
`rateLimit({…})`.

---

## 5. Invariants

1. **Confidentiality** — the main key never leaves the client. The
   server stores ciphertext, the wrapped envelope, and metadata.
2. **Integrity** — every mutation on an entry table requires a valid
   guard, which requires the HMAC sub-key, which requires the main
   key. No main key, no writes.
3. **Domain separation** — HKDF produces AES and HMAC sub-keys from
   distinct labels. A corruption of one domain cannot be replayed as
   the other.
4. **Session coherence** — no "authenticated without key" state:
   decrypt failure or missing key triggers the `KeyMissingModal`.
5. **Reset is destructive** — resetting the password purges the
   user's encrypted data in the same transaction that rotates the
   credentials. There is no orphaned ciphertext lying around.
6. **The page URL never reveals which module the user is on.** While
   a user is authenticated, the URL stays at `/flow` regardless of
   which module they're consulting. The active module lives in the
   client-side Zustand store ; browser-history navigation is
   preserved via `history.pushState({ nodeaModule: id }, '',
   '/flow')` so back / forward still work, but `event.state` never
   leaves the tab. Nginx access logs for **page** loads, the
   browser's own history.pushed URL and any outbound `Referer`
   headers all see a single `/flow` path. Old bookmarks like
   `/flow/library?subview=extraits` are caught by a
   `/flow/*` → `/flow` redirect so they no longer route through
   the server with the leaky path.

   **Known gap — API endpoints still encode the module in their
   path.** Each module mounts its REST routes at `/<collection>-
   entries/records` (e.g. `/mood-entries/records`,
   `/library-items/records`). Any read or write action triggers a
   request to that endpoint. Cross-referencing Nginx access logs
   (path + IP + timestamp), the api's request logs (request id +
   user id when present), and the `sessions` table (user_id ↔ IP
   mapping) lets the operator reconstruct « user U did a list /
   create / update on module M at time T », even though the row
   contents stay encrypted and the rows themselves carry no
   user_id. Closing this leak requires a unified `entries` table
   served by a module-agnostic `/records` endpoint — tracked
   separately, not yet implemented. Self-hosting is the practical
   mitigation today.

---

## 6. The web app supply-chain limit (must read)

Every E2E-encrypted webapp shares one fundamental weakness: **a
compromised server can serve modified JavaScript that exfiltrates
the user's main key before it is used**. The crypto code is loaded
fresh from the server on every page visit, so any tampering with
the served bundle bypasses the entire E2E model. This is not
specific to Nodea — Bitwarden's web vault, Proton Mail web,
Standard Notes web, Cryptee, all face the same problem. Their
mobile and desktop apps mitigate by shipping a signed binary that
isn't re-fetched on each launch; the browser is the gap.

What we ship in Nodea to *narrow* that gap (mitigate, not eliminate):

### 6.1 Subresource Integrity on the entry chunk

`pnpm --filter @nodea/web build` emits `dist/index.html` with
`integrity="sha384-…" crossorigin="anonymous"` on the entry
script and the global stylesheet. The browser refuses to execute
those files if their SHA-384 doesn't match the declared hash, so a
proxy / compromised host that swaps the entry chunk for a
malicious one is blocked at the loader.

**Limitation** : runtime-loaded chunks (route-level `React.lazy`
imports — every `/login`, `/totp`, `/passkeys`, every `/flow`
module loaded on demand when the user switches sections) are NOT
covered by browser SRI in the current build. Their
hashes are listed in `dist/INTEGRITY.txt` for manual verification
(see §6.2) but Vite's `<link rel="modulepreload">` insertion
doesn't yet wire `integrity=` for us. A determined attacker who
can serve a modified lazy chunk bypasses SRI today; the entry
chunk itself stays protected.

### 6.2 Build integrity manifest (`INTEGRITY.txt`)

The same build emits `dist/INTEGRITY.txt` listing every asset's
SHA-384 (base64). The CI workflow uploads it as the
`web-integrity-<commit>` artifact (90-day retention) on every push,
and the published GitHub Release for a tagged version attaches the
same file. A user (or auditor, or self-hoster) verifies their
served bundle by:

```sh
# Compute hashes locally on the deployed instance
( cd /var/www/nodea/dist
  sha384sum index.html assets/* \
  | awk '{ printf "%s\t%s\n", $2, $1 }' )
```

then comparing against the official `INTEGRITY.txt` for the
matching commit. A divergence means the served files are not what
the source repo would build at that commit — either a build-time
issue (different toolchain version) or a server compromise.

The check is manual and out-of-band, which is the point: the
trust anchor is the published release on GitHub, not the running
server.

### 6.3 Self-hosting recommendation

For threat models where a server compromise is plausible
(activists, journalists, anyone who'd be specifically targeted),
the right answer is to **host your own Nodea instance from a
known-good commit**. The server you control = a server you can
audit. Nodea is designed for that exact deployment shape:
docker-compose, no SaaS coupling, every secret loaded from your
own Infisical / `.env`.

---

## 7. Developer checklist

- Generate a fresh IV per AES-GCM encryption (`crypto.getRandomValues`).
- Never log / persist a `CryptoKey`, raw main key, or `guard`.
- Never add a second base64 encoder; use
  [`core/crypto/base64.ts`](../packages/web/src/core/crypto/base64.ts).
- When the Zustand `crypto.status` slice flips to `'missing'`, do not
  attempt decrypt; surface the existing `KeyMissingModal`.
- New modules must reuse `createCollectionClient`; do not reimplement
  the POST/PATCH dance.
- Server responses must never leak `guard` or another user's
  `encrypted_key`. Keep the integration test that asserts this.
- Crypto additions use branded types (`AesMainKey`, `HmacMainKey`, …)
  so mixing primitives fails at compile time.

---

## 8. Data retention & RGPD

> See also the user-facing draft in [`Terms.md`](./Terms.md), which
> consumes this matrix and turns it into plain-language commitments.

Nodea processes personal data under **legitimate interest** (running
the service requested by the user) for everything operational, and
under **explicit consent** for the encrypted journal content (the user
opens an account knowing they're storing E2E-encrypted notes).

### 8.1 Retention matrix

Every table that holds personal-or-derived data is listed below, with
its retention rule and the FK cascade that fires on account deletion.
Tables not listed (e.g. `app_settings`, `announcements`) hold no
personal data.

| Table | Holds | Retention | Erased on `DELETE /auth/me` |
|---|---|---|---|
| `users` | id, email, username, role, OPAQUE wrap blobs, security mode | While the account exists | Yes |
| `opaque_records` | OPAQUE envelope (per-user) | Lifetime of the user row | Yes (FK cascade) |
| `auth_factors` | Passkey credentials (id, label, transports, wrap blobs, prfSupported) | Lifetime of the user row, or until user removes the credential | Yes (FK cascade) |
| `mfa_totp` | TOTP secret (encrypted) + enabled flag | Lifetime of the user row, or until user disables TOTP | Yes (FK cascade) |
| `mfa_totp_recovery_codes` | Hashed backup codes | Lifetime of the user row, single-use (consumed rows kept for audit) | Yes (FK cascade) |
| `mfa_bypass_requests` | Bypass tokens (hashed), confirm/cancel timestamps | Currently kept indefinitely for audit; rows are functionally inert after consume/cancel/expire | Yes (FK cascade) |
| `email_verifications` | One-time tokens for register/reset/change-email | `register` kind purged weekly when expired (cron). Other kinds kept indefinitely until consumed | Yes (FK cascade) |
| `password_reset_tokens` | One-time tokens for password reset | Currently kept indefinitely; functionally inert after consume/expire | Yes (FK cascade) |
| `sessions` | Session cookies + expiry | Purged weekly when `expires_at` past (cron) | Yes (FK cascade) |
| `modules_config` | Per-module HMAC guard + encrypted user-id mapping | Lifetime of the user row | Yes (FK cascade) |
| `user_preferences` | Encrypted UI settings blob | Lifetime of the user row | Yes (FK cascade) |
| `entries_*` (per module) | E2E-encrypted journal content + AAD | Lifetime of the user row, or until user deletes the entry | Yes (FK cascade) |

### 8.2 Right to erasure (RGPD art. 17)

`DELETE /auth/me` (route at
[`packages/api/src/routes/auth-account.ts`](../packages/api/src/routes/auth-account.ts))
deletes the `users` row with `requireFreshPassword`. **Every other
table FK-cascades on `user_id`**, so a single DELETE wipes the entire
tree atomically. The route emits no email and surfaces no audit row
on the user side — the user disappears completely, by design.

Operator-side, the deletion is visible in the next cron run's logs as
`{ users: N, sessions: M }` deltas. There is no soft-delete and no
recovery — once the row is gone, the encrypted blobs become
mathematical noise (the KEK and main key derived from the password
are never persisted anywhere except as wraps gated by the user's
password proof).

### 8.3 Right to portability (RGPD art. 20)

The `Account` view exposes a per-module export that downloads the
decrypted JSON of every entry the user owns. Decryption happens
client-side; the server never sees the cleartext. This satisfies
portability without weakening the E2E model.

### 8.4 Server-side logs

`hono/logger()` writes one line per HTTP request to stdout — method,
path, status, duration. **No body, no headers, no cookies, no
session id**. The `X-Sid` / `X-Guard` headers added in SEC-01 stay
out of access logs by virtue of being headers (not query strings).

In production, stdout is captured by the container runtime. Operator
responsibility: configure log retention at the runtime level
(`docker logs --max-size`, journald, etc.). Recommended:
**rotate at 7 days**, never archive raw logs offsite.

### 8.5 Sentry telemetry

When `VITE_SENTRY_DSN` / `SENTRY_DSN` are set, the SDK ships error
events to Sentry. The `beforeSend` hook (`packages/api/src/sentry.ts`,
`packages/web/src/sentry.ts`) strips cookies, query strings, request
bodies, headers, and `event.user` before transmission. What reaches
Sentry: the stack trace, the route, the status code. No personal
data, no E2E content.

### 8.6 What's NOT yet purged automatically (known gaps)

The following rows accumulate over time and are kept for audit
purposes:
- `mfa_bypass_requests` after `consumed_at` / `cancelled_at`
- `password_reset_tokens` after `consumed_at`
- `email_verifications` of kinds other than `register`

For a tighter retention envelope, extend
[`packages/api/src/cron/index.ts`](../packages/api/src/cron/index.ts)
with delete-where clauses past a chosen audit window (e.g. 90 days).
This is left as an operator decision — the audit value of those rows
is non-zero, and the volumes are tiny in V1.
