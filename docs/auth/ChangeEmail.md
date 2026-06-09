# Change email (partial design — full flow not shipped)

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.6 Change email (partial design — full flow not shipped)

> **Status (updated audit 2026-06).** The `PATCH /auth/email` route
> does the `UPDATE users.email` after a fresh password re-auth,
> **revokes every other session**, and **notifies the old address**
> (best-effort). The OPAQUE envelope is *not* re-registered — and no
> longer needs to be for login to keep working : the
> registration-time identifier is persisted on
> `opaque_records.user_identifier` and login replays it while the
> row lookup uses the current email. (Before that fix, changing the
> email permanently locked the account out of password login.)
>
> The flow below describes the complete envisioned version with
> email re-verification + 7-day cooldown + OPAQUE re-register
> (which would realign the envelope identifier with the current
> email). To be implemented in a dedicated issue if we want the
> full lock; for now the simple route does the job safely.

Heavier than we'd like. Three steps.

### Step A — `POST /auth/change-email/start`

Fresh password re-auth. Body: `{ new_email }`. Server:
1. **Cooldown**: if `users.email_changed_at` is non-NULL and
   `email_changed_at + 7 days > now()` → 429 `email_change_cooldown`
   with the cooldown end date. (Anti-takeover: if an attacker takes
   over the email, they're forbidden from rotating it immediately.)
2. Verify no active `users` row has `new_email`.
3. Generate 6-digit code, insert
   `email_verifications { kind: 'email_change', email: new_email, user_id }`.
4. Send the email to `new_email`.

### Step B — `POST /auth/change-email/verify`

Body: `{ code }`. Server: marks verification consumed. No mutation
on `users.email` yet.

### Step C — `POST /auth/change-email/finalize`

The client must supply a new OPAQUE envelope keyed on `new_email`.
For that, the client has to redo OPAQUE registration with the
password (already obtained via the recent re-auth — but the plain
OPAQUE password is required here, not the `export_key`).

**Implementation note**: OPAQUE registration needs the password in
plaintext. Fresh re-auth doesn't keep it around. Two options:

1. **Hold the password in client RAM** between re-auth (step A) and
   finalize (step C). Risky (XSS).
2. **Ask for the password again** at step C. Cleaner both UX-wise
   and security-wise.

→ **Choice: option 2.** At step C, the screen prompts to re-type
the password, the client runs OPAQUE register on `new_email`,
derives the new `export_key`, re-wraps the KEK, and posts to the
server:

```json
{
  "opaque_register_record_new": "...",
  "wrapped_kek_password_new": "...",
  "wrapped_kek_password_new_iv": "..."
}
```

Server (transaction):
1. UPDATE `users.email = new_email`, `users.email_changed_at = now()`
   (starts the 7-day cooldown for the next change).
2. UPDATE `opaque_records.envelope` (PK is user_id, so we just
   replace the blob — no PK change).
3. UPDATE `users.wrapped_kek_password{,_iv}`.
4. Revoke every other session.
5. Response `200`.

