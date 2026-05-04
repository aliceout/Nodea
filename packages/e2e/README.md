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
| `03-recovery-code-generate-and-use.spec.ts` | `/recovery-code` enable → capture 12 BIP39 words → logout → `/recover` with email + words + new password → land /flow → relogin with new password | ✅ |
| `04-passkey-enroll-and-login.spec.ts` | Virtual WebAuthn authenticator → enroll → logout → assertion login → finish KEK unwrap with password (non-PRF branch) | ✅ |
| `05-change-password-rotates-kek.spec.ts` | `/change-password` → forced logout → old password rejected → new password lands /flow | ✅ |
| `06-account-deletion-cascade.spec.ts` | Account → deletion tab → confirm dialog → land `/login` → DB cascade asserts (`users` + `modules_config` empty) | ✅ |
| `07-module-crud-with-guard.spec.ts` | Mood module → composer create → list → edit → delete with X-Sid + X-Guard headers | ✅ |
| `08-goals-crud.spec.ts` | Goals module → composer create → list → edit → delete (mirror of `07`, second « finished » module covered) | ✅ |
| `09-account-changes.spec.ts` | Settings → Mon compte → username change + email change with re-auth gate | ✅ |
| `10-mfa-bypass-totp.spec.ts` | Lose TOTP → request bypass → click email → DB time-shift past 7-day window → log back in without TOTP | ✅ |
| `11-change-mode-maximum.spec.ts` | TOTP + passkey enrolled → change `security_mode` to `maximum` → assert downgrade auto on TOTP disable | 🚧 follow-up |

The remaining follow-up suites need :
- For bypass (`08`) : `helpers/db.ts` already exposes
  `backdateBypassConfirmation` to short-circuit the 7-day delay.

Important caveats for the specs (03-08) :
- `04-passkey-enroll-and-login` exercises the **non-PRF branch only**.
  Chromium's virtual authenticator does not support the PRF
  extension, so the passkey ceremony succeeds but the KEK isn't
  unwrappable from the credential alone — the spec finishes the
  unlock by typing the password. The PRF unwrap path itself stays
  unit-tested in `packages/web/src/core/crypto/passkey-prf.test.ts`.
- `03-recovery-code-generate-and-use` scrapes the 12-word mnemonic
  by filtering DOM elements that match the BIP39-word shape
  (`/^[a-z]{3,12}$/`). If the `<RecoveryCodeDisplay>` ever wraps
  words in an extra element with non-matching content, the scraper
  will need a `data-testid=recovery-word` hint added to the
  component.
- `07-module-crud-with-guard` assumes the first-run module seed
  fires lazily on first `/flow` navigation. If a future change
  moves the seed to an explicit user action (button click), the
  spec's "click sidebar entry → page settles" sequence may need
  to insert a seeding step.
- `08-goals-crud` follows the same first-run seed assumption as
  `07`. It picks « Goals » via its sidebar entry (i18n title kept
  as `Goals` in both FR and EN) and uses the module-specific
  topbar CTA `+ Nouvel objectif` / `+ New goal` rather than the
  generic Composer trigger. The pencil / trash actions are matched
  on their `aria-label` (`Modifier l'objectif` / `Supprimer
  l'objectif`) so the test stays robust to row-layout tweaks.
- `09-account-changes` exercises the username + email change paths
  on the Settings → Mon compte page. The email change gates on a
  fresh password proof (`requireFreshPassword` middleware, Phase
  7B). The spec deliberately STOPS after asserting the new email
  is visible in the row — it does NOT re-login with the new email,
  because V1 doesn't re-bind the OPAQUE envelope to the new
  `userIdentifier` (cf. JSDoc on `auth-account.ts` `PATCH /email`).
  Re-login with the new email is a Phase 2+ deliverable.
- `10-mfa-bypass-totp` drives the lost-TOTP recovery flow
  end-to-end. Setup mirrors spec 02 for TOTP enrollment, then
  passes through `/security-mode` to switch to `always_totp` so
  TOTP becomes mandatory at login. The bypass UI lives on
  `/login/mfa` behind two escalations (« J'ai perdu mon TOTP »
  → « Demander une récupération par email » → « Envoyer
  l'email »). Mailpit captures the confirmation email,
  `helpers/db.ts.backdateBypassConfirmation` short-circuits the
  7-day delay, and the final re-login lands on `/flow` without a
  TOTP prompt — proving the bypass was consumed at login finish.

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
