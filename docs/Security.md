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

## 2. Main key lifecycle

> **⚠️ LEGACY — en cours de remplacement.** Cette section décrit le
> modèle d'auth actuel (Argon2id direct sur le password, KEK dérivée
> à chaque login depuis `password + encryption_salt`). Il est en
> cours de remplacement par un modèle multi-facteurs basé sur
> OPAQUE + WebAuthn PRF + TOTP, spécifié dans
> [`Auth-Spec.md`](Auth-Spec.md).
>
> La migration suit le plan de [`Auth-Roadmap.md`](Auth-Roadmap.md)
> en 9 phases. Pendant la transition, les deux modèles coexistent
> (lazy migration au login, cf. Auth-Spec §12). Après livraison
> Phase 8, cette section sera réécrite pour refléter le nouveau
> modèle comme seule réalité, et les colonnes legacy
> (`password_hash`, `encryption_salt`, `encrypted_key`) seront
> droppées.
>
> Pour toute évolution crypto/auth pendant la migration : la spec
> qui fait foi est `Auth-Spec.md`, pas cette section.

### 2.1 Register
1. Generate 32 random bytes (`randomBytes(32)`).
2. Derive a KEK via Argon2id from `password + encryption_salt`.
3. Wrap the main key under the KEK with AES-GCM → `encrypted_key`.
4. Zero the source bytes; send `{ encryption_salt, encrypted_key }` to
   the server alongside the invite code and password.

### 2.2 Login
1. Server verifies the password (Argon2id on the stored hash), issues a
   signed session cookie, and returns the user row via `/auth/me`.
2. Client re-derives the KEK and decrypts `encrypted_key` →
   `rawMainKey` (32 bytes).
3. `deriveMainKeys(rawMainKey)` runs HKDF twice (labels `"nodea:aes"`
   and `"nodea:hmac"`) and imports each output as a non-extractable
   `CryptoKey`. The source bytes are zeroed in the `finally` block.
4. The Zustand store caches the `MainKeyMaterial`. No main-key bytes
   are written to disk.

### 2.3 Steady-state
- Every encrypted module consumes `key.aesKey` for AES-GCM and
  `key.hmacKey` for guard derivation.
- On a cold reload the session cookie survives but the main key does
  not (there is no password in hand to re-derive it). The store flips
  `crypto.status = 'missing'` and the layout blocks via
  `KeyMissingModal` until the user logs in again.

### 2.4 Change password
1. Unwrap the main key under the **old** password (client-side). This
   throws on wrong password via the AES-GCM auth-tag, before any
   server call.
2. Re-wrap the same main key under the new password → fresh
   `{ encryption_salt, encrypted_key }`.
3. POST `/auth/change-password` with the new envelope + both passwords.
4. Server revokes every other session and issues a new one.
5. Client re-derives the AES + HMAC sub-keys from the same raw bytes
   (they're unchanged, so every existing ciphertext is still readable).

### 2.5 Password reset (`/auth/request-reset` + `/auth/reset`)
Because the main key was derived from the lost password, **it is
unrecoverable**. The reset flow therefore treats the existing encrypted
data as lost too:

1. Client generates a **fresh** main key + envelope.
2. Server validates the token, then inside a single transaction:
   - deletes every row from all 8 `*_entries` tables,
     `modules_config`, and `user_preferences` for this user;
   - rotates `password_hash` + `encryption_salt` + `encrypted_key`;
   - flips `onboarding_status` back to `pending`;
   - marks the reset token `used_at`;
   - revokes every session.

The `/reset` page hard-gates submission behind a confirmation
checkbox so the user acknowledges the data loss explicitly.

### 2.6 Logout
- `session.logout()` posts to `/auth/logout` (which deletes the
  session row), then `resetAll()` drops the entire Zustand store. The
  `CryptoKey` objects become garbage-collectable.
- `wipeMainKeyMaterial` zeroes any raw-byte helpers still in scope.
  Note: WebCrypto does not expose a way to wipe `CryptoKey` internals —
  we rely on the non-extractable flag + process isolation. A full purge
  requires a hard reload.

---

## 3. Encrypted records

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
guard as a **query parameter** (`?d=<guard>`), so the server compares
but never learns the main key.

---

## 4. HMAC guards

```text
guard = "g_" + hex( HMAC(hmacKey, `${module_user_id}:${record_id}`) )
```

- **Two-phase creation.** On `POST /<collection>/records` the client
  sends `guard: "init"` (it doesn't know the record id yet). The
  server returns the `id`; the client immediately `PATCH`es with
  `guard=init` in the query and the real `guard` in the body, and the
  server promotes.
- **Update / delete** require `?sid=<module_user_id>&d=<guard>`. The
  server does a constant-time compare against the stored guard and
  rejects on mismatch.
- **Deterministic.** No cache, no network. Losing the main key means
  losing the ability to mutate any existing record.

The 1:1 tables (`modules_config`, `user_preferences`) skip the guard:
there is no record id to authenticate, the user *is* the record, and
`requireUser` + `user_id` scoping is sufficient.

---

## 5. Server-side protections

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
- **Surface lisible minimum sur les entry tables** (Mood, Goals,
  Habits, Library, Review, Passage…). Aucune ligne ne porte de
  `user_id`, ni de `created_at` / `updated_at` colonne. Le serveur
  ne peut pas linker une entrée à un user en plain SQL, ni dater
  une écriture côté DB. Les modules qui ont besoin d'un timestamp
  applicatif le mettent dans le `payload` chiffré. Conséquences :
  pas de cascade FK sur user delete (entrées orphelines acceptées,
  illisibles puisque la clé maîtresse est partie), self-delete
  client-driven. Cf. `Auth-Spec.md §2.3`, `Database.md`.

### 5.1 Rate-limit table

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
| `POST /auth/passkey/enroll/{options,finish}` | 10 / 15min | `passkey-enroll` | Setup d'un nouveau passkey, idem TOTP |
| `POST /auth/passkey/{login-options,login-finish}` | 20 / 15min | `passkey-login` | Login passkey-first : tolérant aux annulations utilisateur sur le prompt OS |
| `*    /auth/passkey/:id/...` (rename, remove) | 30 / 15min | `passkey-manage` | Lecture/écriture Settings |

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

## 6. Invariants

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

---

## 7. The web app supply-chain limit (must read)

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

### 7.1 Subresource Integrity on the entry chunk

`pnpm --filter @nodea/web build` emits `dist/index.html` with
`integrity="sha384-…" crossorigin="anonymous"` on the entry
script and the global stylesheet. The browser refuses to execute
those files if their SHA-384 doesn't match the declared hash, so a
proxy / compromised host that swaps the entry chunk for a
malicious one is blocked at the loader.

**Limitation** : runtime-loaded chunks (route-level `React.lazy`
imports — every `/login`, `/totp`, `/passkeys`, every `/flow/*`
module) are NOT covered by browser SRI in the current build. Their
hashes are listed in `dist/INTEGRITY.txt` for manual verification
(see §7.2) but Vite's `<link rel="modulepreload">` insertion
doesn't yet wire `integrity=` for us. A determined attacker who
can serve a modified lazy chunk bypasses SRI today; the entry
chunk itself stays protected.

### 7.2 Build integrity manifest (`INTEGRITY.txt`)

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

### 7.3 Self-hosting recommendation

For threat models where a server compromise is plausible
(activists, journalists, anyone who'd be specifically targeted),
the right answer is to **host your own Nodea instance from a
known-good commit**. The server you control = a server you can
audit. Nodea is designed for that exact deployment shape:
docker-compose, no SaaS coupling, every secret loaded from your
own Infisical / `.env`.

---

## 8. Developer checklist

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
