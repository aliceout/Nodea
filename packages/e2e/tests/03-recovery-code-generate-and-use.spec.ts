import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Recovery code generation + use — proves the « j'ai perdu mon mot
 * de passe » flow works without any email round-trip
 * (Auth-Roadmap §10).
 *
 * Sequence :
 *   1. Register + activate user with password A.
 *   2. Visit /recovery-code, enable. Re-prove password A. Capture
 *      the 12 BIP39 words from the modal. Acknowledge + close.
 *   3. Logout.
 *   4. Visit /recover, type email + the captured 12 words + a NEW
 *      password B. Submit.
 *   5. The page emits a fresh recovery code (rotated). Acknowledge
 *      + close — UI redirects signed in to /flow.
 *   6. Logout. Log back in with password B → /flow. Proves the
 *      recovery flow re-keyed the KEK under the new password.
 */

const NEW_PASSWORD = 'Recovered-Phrase-Cipher-91';

test.beforeEach(async () => {
  await clearInbox();
});

test('recovery code — generate, then use to reset password', async ({ page }) => {
  /* -------- 1. Seed user (password A) -------- */
  const user = await registerAndActivate(page, 'recover');

  /* -------- 2. Generate the recovery code -------- */
  await page.goto('/recovery-code');
  // Single-form flow (FormPanel) : password field + submit. The submit
  // label is « Générer mes 12 mots » for setup, « Régénérer » when the
  // user already has a code (cf. RecoveryCode/FormPanel.tsx). For a
  // freshly-registered user it's setup.
  await page
    .getByLabel(/^Mot de passe actuel$|^Current password$/i)
    .fill(user.password);
  await page
    .getByRole('button', {
      name: /^G.n.rer mes 12 mots$|^R.g.n.rer$|^Generate my 12 words$/i,
    })
    .click();

  // The display shows 12 BIP39 words. They live inside a grid
  // structure rendered by `<RecoveryCodeDisplay>`. Scrape every
  // element matching a single lowercase word and take the first 12.
  // We wait for the panel to mount before scraping.
  const wordLocator = page.locator('[data-testid=recovery-word], li, span, code')
    .filter({ hasText: /^[a-z]{3,12}$/ });
  await expect(wordLocator.first()).toBeVisible({ timeout: 10_000 });
  const allWords = await wordLocator.allTextContents();
  // Filter strictly to the 12 BIP39 words that match the format.
  const mnemonic = allWords
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{3,12}$/.test(w))
    .slice(0, 12)
    .join(' ');
  const wordCount = mnemonic.split(' ').filter(Boolean).length;
  expect(wordCount).toBe(12);

  // Acknowledge saved + close.
  const ack = page.getByRole('checkbox', { name: /noté|saved|sauvegardé/i });
  if (await ack.count() > 0) await ack.check();
  await page.getByRole('button', { name: /Terminé|Done/i }).click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 3. Logout -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });

  /* -------- 4. Use the recovery code on /recover -------- */
  await page.goto('/recover');
  await page.getByLabel(/E-?mail/i).fill(user.email);
  // The mnemonic field is a textarea ; we located it by id earlier.
  await page.locator('#recover-mnemonic').fill(mnemonic);
  await page
    .getByLabel(/^Nouveau mot de passe$|^New password$/i)
    .fill(NEW_PASSWORD);
  await page
    .getByLabel(/Confirmer le mot de passe|Confirm.*password/i)
    .fill(NEW_PASSWORD);
  await page
    .getByRole('button', { name: /Réinitialiser|Reset|Récupérer|Recover/i })
    .click();

  /* -------- 5. Lands directly on /flow -------- */
  // The new design (Tier 3 follow-up) doesn't rotate the recovery
  // code in-place anymore — the server nulls `recovery_code_hash`
  // server-side and the user is dropped on /flow with the sidebar
  // « configure a recovery code » tip reappearing. No mnemonic to
  // acknowledge. The notification email mentions the old code is
  // now invalid.
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 6. Logout + relogin with NEW password -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });
  await page.goto('/login');
  await page.getByLabel(/E-?mail/i).fill(user.email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(NEW_PASSWORD);
  await page
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
