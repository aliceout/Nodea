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

`DELETE /auth/me`

Preconditions (all enforced server-side, in `auth-account.ts`): fresh
password re-auth (`requireFreshPassword`) + a fresh passkey re-auth if a
`passkey` row exists in `auth_factors` (bumped out-of-band via
`/auth/reauth/passkey`, 5-min window) + a live TOTP code if
`mfa_totp.enabled_at` is non-null. Missing/stale factors 401 with a
discriminated code (`passkey_reauth_required` / `totp_required`).

Body: `{ totpCode?: string }` — the live TOTP code, mandatory when TOTP is
enabled, ignored otherwise. The deliberate-confirmation step is an email
re-type + an in-app confirm dialog in the UI (stronger and
language-neutral), not a typed French phrase.

Server: `DELETE FROM users WHERE id` — every FK cascades (sessions,
opaque_records, auth_factors, mfa_totp, mfa_totp_recovery_codes,
mfa_bypass_requests, modules_config, user_preferences). Entry tables carry
no `user_id` and are wiped client-side beforehand.

Response `200`. Cookie cleared.

---

