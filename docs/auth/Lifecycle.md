# Destructive reset, logout, account deletion

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.9 Destructive reset (existing, preserved)

Functionally unchanged from the existing flow, but extended to purge
every new table:

`POST /auth/request-reset` → email with token (if email is verified).
`POST /auth/reset` → token + new password. Server: see purge §4.3,
then creation of the new wraps like in register (but keep
`email_verified_at`).

The reset screen explicitly states: "All your encrypted data will be
deleted. This action is irreversible." + a blocking checkbox.

## 7.10 Logout

`POST /auth/logout`: DELETE the current session. Cookie expired.

`POST /auth/logout-all`: `requireFreshPassword`. DELETE all the
user's sessions. Cookie expired.

`GET /auth/sessions`: `requireUser`. Lists the user's active full
sessions (`id`, `created_at`, `last_seen_at`, `ip_hash` truncated
for preview, `user_agent`, `is_current: true` flag on the current
cookie's session).

`DELETE /auth/sessions/:id`: `requireFreshPassword`. Revokes a
specific session by ID. 404 if the ID doesn't belong to this user
(constant-time to avoid enumeration). 400 if `id == current` (use
`/auth/logout` for that case).

Client side: `resetAll()` on the Zustand store → main key and
sub-keys become garbage-collectable (we can't wipe them, cf. CLAUDE.md
rule 7).

## 7.11 Account deletion

`POST /auth/account/delete`

Preconditions: fresh password re-auth + (passkey re-auth if
`auth_factors.passkey` exists) + (live TOTP code if `mfa_totp.enabled_at`
is non-null).

Body: `{ confirmation_phrase: "supprimer mon compte" }` (in French,
exact match — preserved as the literal user-facing confirmation
phrase).

Server: §4.3 purge transaction + `DELETE FROM users WHERE id`.
Cascade DELETE across every FK.

Response `200`. Cookie cleared.

---

