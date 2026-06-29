# Recovery via KEK code

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.7 Recovery via KEK code

> Generated + confirmed (transcription quiz) DURING signup —
> **mandatory, no skip**: the register `/finish` body carries the
> recovery blobs (`wrappedKekRecovery{,Iv}` + `recoveryCodeHash`) and
> the account isn't created until the user passes the quiz. From
> Settings → Security the user can only **regenerate** it afterwards.
> Legacy accounts created before this change have no code yet → a
> non-dismissable red sidebar warning nags until they configure one.
> Recovery flow reachable via `/recover` or via the "Got a code?"
> link on `/request-reset`.
>
> Source of truth: code in
> `packages/api/src/routes/auth-recovery.ts`. This section describes
> the intent; the actual wire format is slightly tighter (the OPAQUE
> register handshake is folded into `/start` instead of being a
> separate third route).

### Authorisation model

The server stores `users.recovery_code_hash = SHA-256(recovery_bytes)`,
computed and sent by the client at signup time (in the register
`/finish` body — see `Register.md`).
With BIP39's 128 bits of entropy (the remaining 4 bits are a
checksum, not entropy), this hash is non-crackable offline even if
the DB is compromised.

At recovery time, the client sends its locally-computed
`recovery_code_hash`. The server compares it constant-time with the
stored one. **No match → 401, no mutation applied**. That's what
prevents an external attacker from DoS-ing the account by submitting
a new OPAQUE envelope without knowing the recovery code.

Property preserved: *the server doesn't know the recovery code in
cleartext*, only an uncrackable hash.

### Periodic re-verify (Phase 3B)

Setting a phrase once isn't enough: a backup the user can't actually
find when they need it is worse than none (false confidence). So we
periodically ask them to re-prove possession — re-type the 12 words —
on a lazy **backoff ladder** that lengthens as trust builds:

| Streak (consecutive passes) | Next re-verify due after |
|---|---|
| 0 | 6 weeks |
| 1 | ~3 months (13 wk) |
| 2 | ~6 months (26 wk) |
| 3+ | ~1 year (52 wk) |

Two `users` columns drive it (cf. `Database.md`):
`recovery_verified_at` (last proof) + `recovery_verify_streak`. The
cadence is computed **server-side** (`computeRecoveryReverifyDue`,
`packages/api/src/auth/recovery-reverify.ts`) and surfaced as the
`recoveryReverifyDue` boolean on `/auth/me` — the client only reacts
to it, never recomputes the policy. `recovery_verified_at` is anchored
at signup acknowledgement, on every (re)generation, and on each
successful re-verify; the streak resets to 0 whenever the phrase
changes (regenerate, or recover-kek consume).

**Soft gate, never a lockout.** When due, a non-dismissable *amber*
sidebar tip (`local:recovery-reverify`) points to `/recovery-reverify`.
It never blocks `/flow` — the user can defer (« Plus tard »). The
first re-verify a user hits also absorbs the "skin-in-the-game" nudge
(confirming the phrase is real before they've had to rely on it).

#### `POST /auth/security/recovery-code-verify` (authenticated)

Body `{ recoveryCodeHash }` (SHA-256 hex). Middleware
`[requireUser, rateLimit(10/h)]` — **no** `requireFreshPassword`: it
reads + advances counters, it never rotates a wrap. The server
constant-time-compares against the caller's own
`users.recovery_code_hash`:
- **match** → `recovery_verified_at = now()`, `recovery_verify_streak
  += 1`, returns `{ ok: true, streak }`. `recoveryReverifyDue` flips
  false on the next `/auth/me`, clearing the tip.
- **miss** (or no code on file) → `401 invalid_credentials`, no
  mutation.

No anti-enum dummy is needed (unlike `/recover-kek/verify`): the
comparison is against the caller's OWN hash, so a hit/miss leaks
nothing about other accounts. On the client a bad BIP39 checksum is
caught locally (no server hit); both a local miss and a server 401
surface as a single « code invalide » plus a calm escalation toward
**« Régénères-en une nouvelle »** (`/recovery-code`) for a phrase the
user has genuinely lost — never a hard lockout.

### `POST /auth/recover-kek/verify` (issue #48 pre-step)

Body: `{ email, recoveryCodeHash }`. Server:
1. Looks up `users` by email.
2. Constant-time-compares the submitted `recoveryCodeHash` to the
   stored `recovery_code_hash`. **Always runs the comparison**,
   even when the user wasn't found, against a deterministic dummy
   so the timing budget is identical between known and unknown
   email branches.
3. Returns `200 { ok: true }` only when the user exists, has a
   recovery code configured, and the hash matches. Every miss
   (unknown email, no code set, hash mismatch) returns
   `401 { error: 'invalid_credentials' }`. Same shape, same time
   budget — anti-enum preserved.

Why a separate route :
- Lets the SPA confirm an `(email, mnemonic)` pair **before**
  asking the user to commit a new password. Without it, the
  monolithic flow forced the user to retype a strong password
  twice only to discover the mnemonic was wrong — wasted effort
  plus a candidate password lingering in two input fields the
  whole time the mnemonic was being copied.
- Mirrors the 2-stage rhythm we already use on `/request-reset`
  (fork → destroy) and the TOTP bypass (request → confirm).

Hardening :
- **Aggressive rate-limit** (3 attempts/hour, vs `/start`'s 5/h
  because `/start` requires more work to abuse). Keeps the route
  from being brute-forced into a hash oracle.
- **Stateless** : no token is issued. The downstream `/start` +
  `/finish` rotation is still gated by its own hash check in
  `/finish` — this route is just an up-front UX filter.

### `POST /auth/recover-kek/start`

Body: `{ email }`. Server:
1. Loads `users` by email. If not found → opaque response
   `200 { ok: true, recovery_session_id: <random> }` (no leak of
   account existence; we still issue a session_id to keep timings
   indistinguishable).
2. Stores `recovery_session_id` (32 random bytes, base64url) with a
   5 min TTL, bound to `users.id` if found, bound to `null`
   otherwise.
3. Returns `{ recovery_session_id, wrapped_kek_recovery,
   wrapped_kek_recovery_iv }` if a user was found, or
   indistinguishable random blobs otherwise (timing safety).

### Client side (before `/finish`)

1. User types the 12 BIP39 words.
2. Client validates the BIP39 checksum, derives `recovery_bytes`
   (16 bytes).
3. Computes `recovery_code_hash = SHA-256(recovery_bytes)`.
4. Derives `wk_recovery = HKDF(recovery_bytes, "nodea:wrap-kek")`.
5. Attempts to unwrap `wrapped_kek_recovery` client-side → if the
   AES-GCM auth-tag fails, the code is wrong. Immediate UI error
   message **without a server hit**: saves the rate-limit budget
   and avoids polluting server logs with mismatches. (The server
   still does its own hash check at `/finish`, as a double check.)
6. If unwrap succeeds: main key derived through the standard path
   (KEK → `wrapped_main_key` → main_key).
7. User types a new password.
8. Client runs OPAQUE registration (on the current email), derives
   the new `export_key`, re-wraps the KEK under the new
   `wk_password`.
9. Client generates a **new recovery code** (the old one will be
   invalidated) → new `wrapped_kek_recovery` + new
   `recovery_code_hash`. Displayed on screen after success, with an
   acknowledgement checkbox.

### `POST /auth/recover-kek/finish`

Body:
```json
{
  "recovery_session_id": "...",
  "recovery_code_hash": "...",
  "opaque_register_record_new": "...",
  "wrapped_kek_password_new": "...",
  "wrapped_kek_password_new_iv": "...",
  "wrapped_kek_recovery_new": "...",
  "wrapped_kek_recovery_new_iv": "...",
  "recovery_code_hash_new": "..."
}
```

Server:
1. Validates `recovery_session_id` (load, check TTL, consume).
   If bound to `null` → 401 ("non-existent user" path from `/start`).
2. Loads `users.recovery_code_hash`. **Constant-time comparison**
   against the supplied `recovery_code_hash`. If mismatch → 401,
   **no mutation**, logs an `auth.recover.hash_mismatch`.
3. Validates the new OPAQUE envelope (cryptographic consistency).
4. Transaction:
   - UPDATE `opaque_records.envelope` (by `user_id` PK).
   - UPDATE `users.wrapped_kek_password{,_iv}`.
   - UPDATE `users.wrapped_kek_recovery{,_iv}` ← new code.
   - UPDATE `users.recovery_code_hash` ← new hash.
   - DELETE every session of this user.
5. Issues a full session + cookie.
6. Notification email "Your password was reset via recovery code.
   If this wasn't you: destructive reset via /password-reset."

### Mandatory anti-pattern

The `POST /auth/recover-kek/finish` body contains a sensitive hash
(the password isn't in there in cleartext, but `recovery_code_hash`
allows an offline check if the DB is compromised — non-crackable
but still worth protecting). **The logger must blacklist this
route's body.** Cf. §14.

### Regeneration from Settings

Distinct case from the recovery flow: the user is already
authenticated (full session, KEK already in memory) and just wants
to rotate the recovery code (lost paper, doubt, hygiene).

`POST /auth/security/recovery-code/regenerate`

Preconditions: `requireFreshPassword` (cf. matrix §6).

Client side (before POST):
1. Generates a new BIP39 12-word recovery code.
2. Displays it immediately (modal with an "I noted it down"
   checkbox).
3. Derives `recovery_bytes_new`,
   `wk_recovery_new = HKDF(..., "nodea:wrap-kek")`.
4. Wraps the current KEK (in memory):
   `wrapped_kek_recovery_new = AES-GCM(wk_recovery_new, kek,
   AAD=buildAAD([users.id, "recovery"]))`.
5. Computes `recovery_code_hash_new = SHA-256(recovery_bytes_new)`.

Body:
```json
{
  "wrapped_kek_recovery_new": "...",
  "wrapped_kek_recovery_new_iv": "...",
  "recovery_code_hash_new": "..."
}
```

Server (transaction):
1. UPDATE `users.wrapped_kek_recovery{,_iv}`,
   `users.recovery_code_hash`.
2. Bump `users.updated_at`.
3. Response `200 { regenerated_at }`.

The old recovery code becomes invalid immediately (the
`wrapped_kek_recovery` it could decrypt is no longer stored). The
client zeroes `recovery_bytes_new` after the user has copied it.

No notification email (the operation is explicit user-side + fresh
password re-auth = no silent takeover possible).

