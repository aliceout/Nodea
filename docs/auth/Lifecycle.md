# Destructive reset, logout, account deletion

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.9 Destructive reset (existing, preserved)

Functionally unchanged in spirit from the existing flow, but
extended to purge every new table. The reset is an OPAQUE
re-registration, so it runs in **two** steps (the client needs the
server's `registrationResponse` before it can produce a
`registrationRecord`):

`POST /auth/request-reset` → email with token (if email is verified).

`POST /auth/reset/start` → `{ token, registrationRequest }`. Server
validates the token and returns `{ registrationResponse, resetToken,
userId }`.

`POST /auth/reset/finish` → `{ resetToken, registrationRecord,
wrappedMainKey, wrappedMainKeyIv, wrappedKekPassword,
wrappedKekPasswordIv }`. The old main key is unrecoverable, so the
client ships a **fresh** `wrappedMainKey`. Server: purges every
user-owned encrypted row (see [Auth-Spec §4.3 — *Data purged at
destructive reset*](../Auth-Spec.md#43-data-purged-at-destructive-reset)),
replaces every credential blob, marks the reset token used (keeps
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

`PATCH /auth/sessions/current/device-label`: `requireUser`. Sets the
encrypted device label on the current session row (decorates the
"Sessions actives" UI, issue #47). The label is wrapped client-side
under `buildSessionDeviceLabelAAD(users.id)` —
`nodea:v1\x1f<userId>\x1fsession-device-label`.

Client side: `resetAll()` on the Zustand store → main key and
sub-keys become garbage-collectable (we can't wipe them, cf. CLAUDE.md
rule 7).

## 7.11 Account deletion

`DELETE /auth/me`

Preconditions: `requireUser` + `requireFreshPassword` (fresh
password re-auth). Re-auth: see Auth-Spec §6 (row: *Delete
account*).

Body: **empty** (`DeleteSelfBodySchema` — a loose `{}`). There is no
`POST /auth/account/delete` route and no `confirmation_phrase` field
on the wire. The confirmation gating lives entirely **client-side**:
the UI requires the user to retype their email, pass a fresh
password re-auth, and accept a confirm dialog before firing the
request.

Server: §4.3 purge transaction + `DELETE FROM users WHERE id`.
Cascade DELETE across every FK.

Response `200`. Cookie cleared.

---

