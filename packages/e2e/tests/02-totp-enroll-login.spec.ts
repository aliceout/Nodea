import { test, expect } from '@playwright/test';
import { clearInbox, waitForActivationLink } from '../helpers/mailpit.ts';
import { totpCode } from '../helpers/totp.ts';

/**
 * TOTP enroll → log out → log back in with TOTP code.
 *
 * Drives the Settings TOTP flow end-to-end:
 *   1. Register + activate (so the user has a real session).
 *   2. Open `/totp`, prove password (req'd by 7B middleware), get
 *      a base32 secret, type a valid TOTP code, ack backup codes.
 *   3. Log out.
 *   4. Log back in — the LoginMfa screen demands a TOTP code; we
 *      generate one from the secret captured at step 2 and submit.
 *   5. Land on /flow/home.
 *
 * The base32 secret is displayed on the page for manual entry —
 * we scrape it from the DOM and feed it through `otplib` to
 * compute the code that matches the api's verifier.
 */

const STRONG_PASSWORD = 'Correct-Horse-Battery-Staple-42';

test.beforeEach(async () => {
  await clearInbox();
});

test('TOTP enroll + login with code', async ({ page }) => {
  // Bumped from default 30 s to accommodate the 31 s wait between
  // TOTP enroll-verify and the re-login (anti-replay window).
  test.setTimeout(90_000);

  const email = `totp-${Date.now()}@example.com`;
  const username = `totp${Date.now()}`;

  /* -------- 1. Register + activate -------- */
  await page.goto('/register');
  await expect(
    page.getByRole('button', { name: /^Cr.er mon compte$|^Create account$/i }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Nom d.utilisateur.*$|^Username$/i).fill(username);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  const confirmField = page.getByLabel(/Confirmer|Confirm/i);
  if (await confirmField.count() > 0) {
    await confirmField.fill(STRONG_PASSWORD);
  }
  await page.getByRole('button', { name: /^Cr.er mon compte$|^Create account$/i }).click();
  const link = await waitForActivationLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 2. Enroll TOTP -------- */
  await page.goto('/totp');
  // ListView (disabled state) — single form : password + « Activer TOTP »
  // button. The button gates on `password.length > 0` (cf.
  // packages/web/src/app/pages/Totp/ListView.tsx). The click triggers
  // /auth/reauth/password + /auth/totp/enroll/start in one go.
  await page
    .getByLabel(/^Mot de passe actuel$|^Current password$/i)
    .fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Activer TOTP$|^Enable TOTP$/i })
    .click();

  // SecretPanel (Activation TOTP · 1/2) — QR + masked base32 + 6-digit
  // code field. The base32 secret is masked with bullets by default ;
  // reveal it via the eye button before scraping. The secret <p>
  // carries `data-testid=totp-secret` so we don't accidentally match
  // some other font-mono <p> elsewhere on the page.
  await page
    .getByRole('button', { name: /^Afficher la cl.$|^Reveal the key$/i })
    .click();
  const secretLocator = page.locator('[data-testid=totp-secret]');
  await expect(secretLocator).toBeVisible({ timeout: 10_000 });
  const secret =
    (await secretLocator.textContent())?.replace(/\s+/g, '') ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  // Generate the matching TOTP code and type it.
  const code = await totpCode(secret);
  await page.getByLabel(/^Code à 6 chiffres/i).fill(code);
  await page.getByRole('button', { name: /^Activer$|^Activation…$/i }).click();

  // BackupCodesPanel (Activation TOTP · 2/2) — ack the 10 codes, click
  // « Terminé ». The button gates on the ack checkbox.
  await page
    .getByRole('checkbox', { name: /not.|saved|sauvegard./i })
    .check();
  await page.getByRole('button', { name: /^Terminé$|^Done$/i }).click();

  // After done, the parent flips back to the enabled-state ListView ;
  // /me reports `totpEnabled = true` and the page renders « Désactiver
  // TOTP » as the destructive CTA.
  await expect(
    page.getByRole('button', { name: /^Désactiver TOTP$|^Disable TOTP$/i }),
  ).toBeVisible({ timeout: 10_000 });

  /* -------- 3. Log out -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });

  /* -------- 4. Log back in — must demand TOTP -------- */
  // Wait past the 30 s TOTP window so the re-login uses a fresh code
  // (the api enforces `last_window` anti-replay : a code accepted at
  // enroll-verify won't be accepted again until the next window).
  await page.waitForTimeout(31_000);
  await page.goto('/login');
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
    .click();
  await expect(page).toHaveURL(/\/login\/mfa/, { timeout: 10_000 });

  // Generate fresh code (a new 30-s window may have started since
  // step 2) and submit.
  const liveCode = await totpCode(secret);
  await page.getByLabel(/Code TOTP|TOTP code|TOTP/i).fill(liveCode);
  await page.getByRole('button', { name: /Vérifier|Verify/i }).click();

  /* -------- 5. Land on /flow -------- */
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
