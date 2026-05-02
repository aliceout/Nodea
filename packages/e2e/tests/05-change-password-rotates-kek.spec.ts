import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Change password — proves the OPAQUE re-encryption + KEK rotation
 * flow works end-to-end (Auth-Roadmap §11).
 *
 * Sequence :
 *   1. Register + activate user with password A.
 *   2. Visit /change-password, type password A as `current` and a
 *      new password B as `new` + `confirm`.
 *   3. Submit. The page forces a logout and redirects to
 *      `/login?password-changed=1`.
 *   4. Try to log in with password A → must fail.
 *   5. Log in with password B → must succeed and land on /flow.
 *
 * The KEK rotation is invisible from outside (the wrap blob is
 * re-emitted server-side), but a successful step 5 proves the new
 * KEK + main key derivation chain works under the new password.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('change password — old refused, new accepted', async ({ page }) => {
  /* -------- 1. Register + activate (password A = STRONG_PASSWORD) -------- */
  const user = await registerAndActivate(page, 'pwchg');
  const oldPassword = user.password;
  const newPassword = 'Brand-New-Cipher-Block-77';

  /* -------- 2. Visit /change-password and submit -------- */
  await page.goto('/change-password');
  await page
    .getByLabel(/^Mot de passe.*actuel$|^Current password$/i)
    .fill(oldPassword);
  await page
    .getByLabel(/^Nouveau mot de passe$|^New password$/i)
    .fill(newPassword);
  await page
    .getByLabel(/Confirmer le nouveau mot de passe|Confirm new password/i)
    .fill(newPassword);

  await page
    .getByRole('button', {
      name: /Mettre à jour et se reconnecter|Update and sign out/i,
    })
    .click();

  /* -------- 3. Forced logout + redirect -------- */
  await expect(page).toHaveURL(/\/login\?password-changed=1/, {
    timeout: 10_000,
  });

  /* -------- 4. Old password must fail -------- */
  await page.getByLabel(/E-?mail/i).fill(user.email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(oldPassword);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();
  // We stay on /login because the credentials are wrong. The error
  // message wording varies (`identifiants invalides` / `invalid_credentials`),
  // so we just assert the URL didn't move to /flow.
  await expect(page).not.toHaveURL(/\/flow/, { timeout: 5_000 });

  /* -------- 5. New password succeeds -------- */
  // Re-fill (the form may have cleared on error or kept the email).
  await page.getByLabel(/E-?mail/i).fill(user.email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(newPassword);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
