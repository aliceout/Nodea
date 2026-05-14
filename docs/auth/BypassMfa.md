# Bypass an MFA factor by email

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.8 Bypass an MFA factor by email

> Code: routes `packages/api/src/routes/auth-mfa-bypass.ts`,
> helpers `packages/api/src/auth/mfa-bypass.ts`, email templates
> `services/email/templates/mfa-bypass.ts`. UI on `/login/mfa`
> (lost-factor links + inline confirm dialog) and Settings →
> Security (active-bypass row + cancel button). Lazy application
> at login: `applyConsumableBypass` is called from
> `/auth/login/finish` AND `/auth/passkeys/login/finish` before the
> required-factors computation. No cron — consumption is
> auth-triggered.

Common mechanism for recovering from the loss of an MFA factor
without breaking E2E. Hard 7-day delay after email confirmation,
only one bypass active at a time (across factors — a user with a
passkey bypass in progress cannot start a TOTP bypass in parallel).

### "Lost two things = locked out" policy (cf. §6.2)

Bypassing one factor is only offered if **all the other factors
required by the current mode are verifiable**. Concretely, at
`POST /auth/mfa/bypass/request` time the `mfa_pending` session must
already have:

| Mode | `totp` bypass allowed if | `passkey` bypass allowed if |
|---|---|---|
| `password_or_passkey` | N/A (TOTP not required) | N/A (passkey is alternative to password) |
| `always_2fa` | `mfa_password_verified` OR `mfa_passkey_verified` | N/A (passkey not required) |
| `maximum` | `mfa_password_verified` AND `mfa_passkey_verified` | `mfa_password_verified` AND `mfa_totp_verified` |

If the condition isn't met → 409 `multi_factor_loss` → the UI
redirects to the destructive reset page.

### Initiation

On the `mfa_pending` screen, conditional button:
- "I lost my TOTP" if TOTP required AND unverified AND conditions OK;
- "I lost my passkey" if passkey required AND unverified AND
  conditions OK.

`POST /auth/mfa/bypass/request`

Body: `{ factor: 'totp' | 'passkey' }`.

Preconditions: active `mfa_pending` session. §6.2 conditions met.

Server:
1. Verifies eligibility per mode (table above).
2. Verifies no `mfa_bypass_requests` row that's not cancelled and
   not consumed exists for this user (across factors). If yes →
   409 `bypass_already_active`.
3. Generates `confirm_token` (32 random bytes, base64url).
   Stores SHA-256 hash. The `cancel_token_hash` column stays
   NOT NULL in the schema — we write a placeholder hash there
   (token discarded server-side) to avoid a migration; nothing on
   the wire will ever match this hash.
4. INSERT `mfa_bypass_requests { factor, expires_at: now+14d,
   confirm_token_hash, cancel_token_hash: <placeholder> }`.
   (Request TTL = 14 days, leaving 7d of confirmation window +
   7d of actual delay; the "real" 7-day delay starts at
   `confirmed_at`.)
5. Sends an email with **a single link** (template differs by
   `factor`):
   - `https://<rp_id>/auth/bypass/confirm?t=<confirm_token>` (SPA
     route, not `/api`).
6. Response `200 { earliestApplyAt: <ISO> }`.

### Email confirmation

`GET /auth/mfa/bypass/confirm?t=<token>` returns JSON discriminated
by `status`; the email link points at the SPA
(`/auth/bypass/confirm?t=…`) which calls the API and renders the
page.

Server:
1. Hashes the token, loads the request.
2. Branches: `cancelled` / `consumed` / `expired` / `unknown` →
   matching status, HTTP 410 (or 400/404 if the token is
   malformed / unknown). The SPA renders the right error panel.
3. If already confirmed → status `already_confirmed` + `factor` +
   `earliestApplyAt` (= `confirmed_at + 7 days`).
4. Otherwise: `confirmed_at = now()` then status `ok` + `factor` +
   `earliestApplyAt` (= `now + 7 days`). The "real" 7-day counter
   starts here (not at request time).

The SPA renders a page in the `/totp` / `/passkeys` style with a
**live `Dd HHh MMmin` countdown** until `earliestApplyAt` (1 Hz
tick, minute-grained display to avoid visual noise; days disappear
when the remainder drops below 24h).

### Cancellation

**No cancellation email link.** A pending request is auto-cancelled
at the next promotion to a `full` session
(`cancelPendingBypassesForUser` wired into `/auth/login/finish`,
`/auth/passkeys/login/finish`, `/auth/mfa/{totp,passkey}/finish`,
and the recovery code reset). A successful complete login proves
the user still controls the allegedly-lost factor — the request is
moot and gets cancelled. The legitimate owner of a compromised
account therefore only has to log in normally to defuse a forged
request: no click on an email link required (and hence no
"click here to defuse" phishing surface in the inbox).

Consequence: no "active request" surface inside a full session,
the pair "authenticated user + pending bypass" cannot coexist.

### Applying the bypass at login

At the next login. After `/auth/login/finish` (or
`/auth/passkeys/login/finish`), if factor `<factor>` is required
and unverified, the server checks:

```sql
SELECT id, factor FROM mfa_bypass_requests
WHERE user_id = $1
  AND factor = $2
  AND confirmed_at IS NOT NULL
  AND cancelled_at IS NULL
  AND consumed_at IS NULL
  AND confirmed_at + interval '7 days' <= now()
  AND expires_at > now()
LIMIT 1
```

If found: mark `consumed_at = now()`, transaction depending on the
factor.

**If `factor = 'totp'`**:
1. `UPDATE mfa_totp SET enabled_at = NULL`.
2. `DELETE FROM mfa_totp_recovery_codes WHERE user_id = $1`.
3. Forces the "Re-enable your TOTP" screen post-login (shown until
   `mfa_totp.enabled_at IS NULL` is no longer true).
4. `mfaTotpVerified = true` on the pending session.
5. If `users.security_mode = 'maximum'` → auto downgrade to
   `password_or_passkey` (cf. §6.1).
6. If `users.security_mode = 'always_2fa'` → auto downgrade to
   `password_or_passkey`.
7. Notification email "Your TOTP has been disabled."

**If `factor = 'passkey'`**:
1. `DELETE FROM auth_factors WHERE user_id = $1 AND kind = 'passkey'`.
   We delete **all** passkeys (the user will re-enroll fresh ones).
2. Forces the "Enroll a new passkey" screen post-login if
   `security_mode = 'maximum'`.
3. `mfaPasskeyVerified = true` on the pending session.
4. If `users.security_mode = 'maximum'` → auto downgrade to
   `password_or_passkey` (the user can raise the mode after
   re-enrollment).
5. Notification email "All your passkeys have been disabled."

**In every case**:
- Revoke every **other** session (DELETE WHERE user_id AND
  id <> current).
- The email contains an instruction "If this wasn't you: use the
  destructive reset on the login page" — destructive reset stays
  the only recourse on compromise.

