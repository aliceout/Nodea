# @nodea/e2e — Playwright end-to-end tests

End-to-end test suite covering the auth flows that vitest +
supertest can't reach: real browser ceremonies (WebAuthn, copy /
paste, focus management), email-link round-trips through Mailpit,
and `requireFreshPassword` / stepped-MFA UX paths.

---

## Where to find what

- **Comment lancer les tests** (commandes pnpm, pré-requis machine,
  variantes debug) → [`docs/Development.md §2 Tests`](../../docs/Development.md#2-tests).
- **Setup local** (Postgres, Mailpit, env vars, premier seed) →
  [`docs/Development.md §1 Setup local`](../../docs/Development.md#1-setup-local-de-z%C3%A9ro).
- **Caveats par spec** (sélecteurs, behaviors Playwright spécifiques) →
  ce README, sections « Coverage » et « Important caveats » ci-dessous.
- **Helpers** (`helpers/db.ts`, `helpers/mailpit.ts`, etc.) → fin de
  ce README.

Le contenu transversal (« lancer les 3 suites », recettes pour ajouter
une route ou un module) vit dans `docs/Development.md` — une seule
source de vérité.

---

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
| `11-i18n-switch.spec.ts` | Switch FR ↔ EN via sidebar footer + persist across reload + key labels translated on multiple surfaces | ✅ |
| `12-admin-announcements.spec.ts` | Promote to admin → Admin tab → create announcement → toggle active/inactive → delete with confirm | ✅ |
| `13-privacy-invariants.spec.ts` | URL stays `/flow` across module switches + `document.title === 'Nodea'` + no `?token=` / `?d=` / `?guard=` in any captured request URL | ✅ |
| `14-change-mode-maximum.spec.ts` | TOTP + passkey enrolled → change `security_mode` to `maximum` → assert downgrade auto on TOTP disable | 🚧 follow-up |

---

## Important caveats per spec

- **`04-passkey-enroll-and-login`** exercises the **non-PRF branch
  only**. Chromium's virtual authenticator does not support the PRF
  extension, so the passkey ceremony succeeds but the KEK isn't
  unwrappable from the credential alone — the spec finishes the
  unlock by typing the password. The PRF unwrap path itself stays
  unit-tested in `packages/web/src/core/crypto/passkey-prf.test.ts`.
- **`03-recovery-code-generate-and-use`** scrapes the 12-word mnemonic
  by filtering DOM elements that match the BIP39-word shape
  (`/^[a-z]{3,12}$/`). If the `<RecoveryCodeDisplay>` ever wraps
  words in an extra element with non-matching content, the scraper
  will need a `data-testid=recovery-word` hint added to the
  component.
- **`07-module-crud-with-guard`** assumes the first-run module seed
  fires lazily on first `/flow` navigation. If a future change
  moves the seed to an explicit user action (button click), the
  spec's "click sidebar entry → page settles" sequence may need
  to insert a seeding step.
- **`08-goals-crud`** follows the same first-run seed assumption as
  `07`. Picks « Goals » via its sidebar entry (i18n title kept as
  `Goals` in both FR and EN) and uses the module-specific topbar
  CTA `+ Nouvel objectif` / `+ New goal`. Pencil / trash actions
  are matched on their `aria-label`.
- **`09-account-changes`** exercises username + email change on the
  Settings → Mon compte page. The email change gates on a fresh
  password proof (`requireFreshPassword` middleware). The spec
  deliberately STOPS after asserting the new email is visible in
  the row — V1 doesn't re-bind the OPAQUE envelope to the new
  `userIdentifier` (cf. JSDoc on `auth-account.ts` `PATCH /email`).
  Re-login with the new email is a Phase 2+ deliverable.
- **`10-mfa-bypass-totp`** drives the lost-TOTP recovery flow
  end-to-end. Setup mirrors spec 02 for TOTP enrollment, then
  passes through `/security-mode` to switch to `always_totp`. The
  bypass UI lives on `/login/mfa` behind two escalations
  (« J'ai perdu mon TOTP » → « Demander une récupération par
  email » → « Envoyer l'email »). Mailpit captures the
  confirmation email, `helpers/db.ts.backdateBypassConfirmation`
  short-circuits the 7-day delay.
- **`11-i18n-switch`** uses the `<select aria-label="Préférence de
  langue">` in `SidebarFooter.tsx` for the toggle, asserts on
  labels from sidebar / topbar / Account → Identity tab.
- **`12-admin-announcements`** uses `helpers/db.ts.promoteToAdmin`
  to flip a freshly registered user to admin role (the register
  endpoint always creates a `user` role). Tabs aren't yet i18n'd,
  the spec matches FR labels only.
- **`13-privacy-invariants`** captures every request URL during a
  navigation session and asserts none contain `?token=` / `?t=` /
  `?d=` / `?sid=` / `?guard=`. Whitelists the legitimate setup URLs
  (`/activate?token=`, `/auth/bypass/confirm?t=`,
  `/auth/register/invite-info?token=`) explicitly.

---

## Helpers (`helpers/`)

- **`global-setup.ts`** — DB create / migrate / truncate before the
  test run starts.
- **`db.ts`** — direct Postgres client for state assertions and
  time-shifting. Exposes `getUserIdByEmail`, `promoteToAdmin`,
  `getSecurityMode`, `isTotpEnabled`, `backdateBypassConfirmation`.
- **`mailpit.ts`** — poll the Mailpit HTTP API for messages, extract
  activation / bypass-confirm links from the body.
- **`totp.ts`** — `otplib`-backed code generator that matches the
  api's verifier (SHA-1 / 6 digits / 30 s).
- **`webauthn.ts`** — attach a Chromium CDP virtual authenticator
  (used by the passkey suite).
- **`flows.ts`** — composable `registerAndActivate` / `login` /
  `logout` blocks reused across tests.

---

## Playwright-specific behavior notes

- **Tests are not independent.** `global-setup.ts` truncates every
  user-data table once before the run, then tests execute serially
  (`workers: 1`). Each test uses a unique email (timestamp-suffixed)
  to avoid collisions if a previous run was interrupted mid-truncate.
- **`webServer` startup** can take 30 s on a cold pnpm cache. The
  `timeout: 60_000` in the Playwright config is conservative.
- **Mailpit can leak between tests** — every `beforeEach` calls
  `clearInbox()` so a stray message from a previous test doesn't
  match a current `waitForEmail` predicate.
- **Chromium-only.** Firefox / WebKit aren't in the Playwright
  config — adding them would require `playwright install firefox
  webkit` + new `projects[]` entries. Browser-compat sanity stays
  manual (cf. `SANITY-CHECKLIST.md` section 7).
