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
  const email = `totp-${Date.now()}@example.com`;
  const username = `totp${Date.now()}`;

  /* -------- 1. Register + activate -------- */
  await page.goto('/register');
  await expect(
    page.getByRole('button', { name: /S.inscrire|Register/i }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/Identifiant|Username/i).fill(username);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  const confirmField = page.getByLabel(/Confirmer|Confirm/i);
  if (await confirmField.count() > 0) {
    await confirmField.fill(STRONG_PASSWORD);
  }
  await page.getByRole('button', { name: /S.inscrire|Register/i }).click();
  const link = await waitForActivationLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 2. Enroll TOTP -------- */
  await page.goto('/totp');
  // The first stage is "Activer" — clicking it opens the password
  // proof form.
  await page.getByRole('button', { name: /Activer/i }).click();
  // Password proof form. The page calls /auth/reauth/password
  // before /auth/totp/enroll/start.
  await page.getByLabel(/^Mot de passe.*actuel|Current password/i).fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Once enrollment-start succeeds, the page displays the secret
  // base32 string + the 10 backup codes. Scrape the secret.
  const secretLocator = page.locator('[data-testid=totp-secret], code, pre').filter({
    hasText: /^[A-Z2-7]{16,}$/,
  });
  await expect(secretLocator.first()).toBeVisible({ timeout: 10_000 });
  const secret = (await secretLocator.first().textContent())?.replace(/\s+/g, '') ?? '';
  expect(secret.length).toBeGreaterThanOrEqual(16);

  // Generate the matching TOTP code and type it.
  const code = await totpCode(secret);
  await page.getByLabel(/Code|TOTP/i).fill(code);

  // Acknowledge backup codes saved.
  const ack = page.getByRole('checkbox', { name: /noté|saved|sauvegardé/i });
  if (await ack.count() > 0) await ack.check();

  await page.getByRole('button', { name: /Activer|Verify|Confirmer/i }).click();

  // After verify, /me reports `totpEnabled = true`. The page
  // transitions to the idle state for an enabled user.
  await expect(page.getByText(/désactiver|disable/i)).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 3. Log out -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });

  /* -------- 4. Log back in — must demand TOTP -------- */
  await page.goto('/login');
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
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
