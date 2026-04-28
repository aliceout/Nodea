# @nodea/e2e — Playwright end-to-end tests

End-to-end test suite covering the auth flows that vitest +
supertest can't reach: real browser ceremonies (WebAuthn, copy /
paste, focus management), email-link round-trips through Mailpit,
and `requireFreshPassword` / stepped-MFA UX paths.

This is **Auth-Roadmap Phase 7D** — the framework + a smoke test
+ a TOTP enroll/login test ship today; passkey enrollment and
the MFA bypass scenario are tracked as follow-up issues
(see "Coverage" below).

## Pre-requisites

The Playwright runner does NOT bootstrap these — make sure
they're up before invoking `pnpm test`:

1. **Postgres** on `:5433` (the dev compose default). The runner
   creates / migrates the `nodea_e2e` database automatically on
   first run via `helpers/global-setup.ts`.
   ```sh
   docker compose up -d postgres
   ```

2. **Mailpit** on `:1025` SMTP + `:8025` HTTP API. The api's
   email service points at Mailpit by default
   (`SMTP_HOST=localhost`, `SMTP_PORT=1025` in the dev `.env`).
   ```sh
   # macOS / linux native binary
   mailpit --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025

   # or via docker
   docker run -d --name nodea-mailpit \
     -p 1025:1025 -p 8025:8025 \
     axllent/mailpit
   ```

3. **`.env`** at the repo root with the standard dev vars
   (DATABASE_URL, COOKIE_SECRET, OPAQUE_SERVER_SETUP, WEBAUTHN_*,
   SMTP_*). The Playwright config overrides only `DATABASE_URL`
   to point at `nodea_e2e`.

4. **Chromium binary** — Playwright ships its own copy. One-shot
   install:
   ```sh
   pnpm --filter @nodea/e2e install:browsers
   ```

## Running

```sh
# Headless, full run
pnpm --filter @nodea/e2e test

# Watch / debug mode with the Playwright inspector
pnpm --filter @nodea/e2e test:ui

# Headed (browser visible) — useful when a selector is misbehaving
pnpm --filter @nodea/e2e test:headed

# Open the HTML report from the last run
pnpm --filter @nodea/e2e report
```

The Playwright config auto-starts the api (`pnpm --filter
@nodea/api start`) on `:3000` and the web (`pnpm --filter
@nodea/web dev`) on `:8089`. Both are torn down at the end of the
run when `reuseExistingServer: false` (CI mode); locally, an
existing dev server is reused.

## Coverage

| Test | What it exercises | Status |
|---|---|---|
| `01-register-activate-login.spec.ts` | Register → Mailpit activation email → magic-link visit → login → /flow | ✅ |
| `02-totp-enroll-login.spec.ts` | Settings TOTP enroll → log out → log back in via stepped MFA with the matching otplib code | ✅ |
| `03-passkey-enroll-login.spec.ts` | Virtual WebAuthn authenticator → enroll → log out → log back in via passkey | 🚧 follow-up |
| `04-mfa-bypass-totp.spec.ts` | Lose TOTP → request bypass → click email → DB time-shift past 7-day window → log back in without TOTP | 🚧 follow-up |
| `05-change-mode-maximum.spec.ts` | TOTP + passkey enrolled → change `security_mode` to `maximum` → assert downgrade auto on TOTP disable | 🚧 follow-up |

The follow-up suites need :
- For passkey : the virtual authenticator from
  `helpers/webauthn.ts` (Chromium CDP) — works for plain WebAuthn
  but **does not support PRF**. So those tests will exercise the
  non-PRF branch (passkey present, password still required for
  KEK) ; the PRF unwrap path stays unit-tested in
  `packages/web/src/core/crypto/passkey-prf.test.ts`.
- For bypass : `helpers/db.ts` already exposes
  `backdateBypassConfirmation` to short-circuit the 7-day delay.

## Helpers

- `helpers/global-setup.ts` — DB create / migrate / truncate before
  the test run starts.
- `helpers/db.ts` — direct Postgres client for state assertions
  and time-shifting.
- `helpers/mailpit.ts` — poll the Mailpit HTTP API for messages,
  extract activation / bypass-confirm links from the body.
- `helpers/totp.ts` — `otplib`-backed code generator that matches
  the api's verifier (SHA-1 / 6 digits / 30 s).
- `helpers/webauthn.ts` — attach a Chromium CDP virtual
  authenticator (used by the passkey suite once it lands).
- `helpers/flows.ts` — composable register / login / logout
  blocks reused across tests.

## Notes

- **Tests are not independent.** `helpers/global-setup.ts`
  truncates every user-data table once before the run, then tests
  execute serially (`workers: 1`). Each test uses a unique email
  (timestamp-suffixed) to avoid collisions if a previous run was
  interrupted mid-truncate.
- **`webServer` startup** can take 30 s on a cold pnpm cache. The
  `timeout: 60_000` in the Playwright config is conservative.
- **Mailpit can leak between tests** — every `beforeEach` calls
  `clearInbox()` so a stray message from a previous test doesn't
  match a current `waitForEmail` predicate.
