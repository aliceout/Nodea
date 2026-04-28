import { test, expect } from '@playwright/test';
import { clearInbox, waitForActivationLink } from '../helpers/mailpit.ts';

/**
 * Happy path — register → activation email → login → /flow/home.
 *
 * Smoke test that validates the entire e2e harness:
 *   - api + web are reachable through the webServer config;
 *   - Postgres + the e2e database are wired;
 *   - Mailpit is intercepting outgoing email;
 *   - the magic-link activation flow lands the user on the
 *     authenticated home.
 *
 * Pre-requisite: open registration must be enabled. The api seeds
 * `app_settings.open_registration = true` by default; if your dev
 * environment toggled it off, the register UI will refuse to show
 * a form. Toggle back on via `/admin` or directly in DB.
 */

const STRONG_PASSWORD = 'Correct-Horse-Battery-Staple-42';

test.beforeEach(async () => {
  await clearInbox();
});

test('register → activate via email → login → /flow', async ({ page }) => {
  const email = `happy-${Date.now()}@example.com`;
  const username = `happy${Date.now()}`;

  // 1. Open registration form.
  await page.goto('/register');
  // Wait for the open-mode form to mount (the page resolves its
  // mode async so the inputs aren't there on first paint).
  await expect(page.getByRole('button', { name: /S.inscrire|Register/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/Identifiant|Username/i).fill(username);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  // The form has a confirm-password field as the second password
  // input.
  const confirmField = page.getByLabel(/Confirmer|Confirm/i);
  if (await confirmField.count() > 0) {
    await confirmField.fill(STRONG_PASSWORD);
  }

  await page.getByRole('button', { name: /S.inscrire|Register/i }).click();

  // 2. Wait for the activation email + extract the magic link.
  const link = await waitForActivationLink(email);
  expect(link).toMatch(/\/activate\?token=/);

  // 3. Visit the activation link. Activate.tsx auto-redirects
  //    to /login?activated=1.
  await page.goto(link);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  // 4. Type the password back to obtain a real session cookie.
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();

  // 5. Land on the flow home — proves a `full` session exists.
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
