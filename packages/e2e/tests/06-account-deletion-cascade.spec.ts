import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { db, getUserIdByEmail } from '../helpers/db.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Account deletion — proves the FK cascade wipes every user-owned
 * row when the user deletes themselves (Auth-Roadmap §12 + Database
 * §3.4).
 *
 * Sequence :
 *   1. Register + activate. Capture `user.id` from DB.
 *   2. Navigate to Account → "Account deletion" tab.
 *   3. Type email + current password. Accept the window.confirm
 *      dialog. Click "Supprimer définitivement".
 *   4. UI redirects to /login.
 *   5. DB assertions :
 *        - users WHERE id = userId → 0 rows.
 *        - modules_config WHERE user_id = userId → 0 rows.
 *      Both must be empty — proves the FK cascade fired and no
 *      orphan row survived.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('account deletion — cascades all user-owned rows', async ({ page }) => {
  /* -------- 1. Register + capture id -------- */
  const user = await registerAndActivate(page, 'delcasc');
  const userId = await getUserIdByEmail(user.email);
  expect(userId).not.toBeNull();

  /* -------- 2. Reach the deletion form -------- */
  // Account is the legacy `/flow` Account view ; the URL stays at
  // /flow because of the privacy invariant. We navigate via the
  // sidebar / topbar Account entry.
  await page.goto('/flow');
  await page.getByRole('link', { name: /Compte|Account/i }).first().click();
  // Switch to the deletion tab.
  await page
    .getByRole('button', { name: /Suppression du compte|Account deletion/i })
    .click();

  /* -------- 3. Fill confirmation + accept window.confirm -------- */
  await page
    .getByLabel(/Tape ton e-?mail|Type your email/i)
    .fill(user.email);
  await page
    .getByLabel(/^Mot de passe.*actuel$|^Current password$/i)
    .fill(user.password);

  // The button triggers `window.confirm` BEFORE the network call —
  // hook into the dialog event so the test auto-accepts.
  page.once('dialog', (dialog) => dialog.accept().catch(() => undefined));

  await page
    .getByRole('button', { name: /Supprimer définitivement|Delete permanently/i })
    .click();

  /* -------- 4. UI redirect -------- */
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  /* -------- 5. DB cascade assertions -------- */
  const usersLeft = await db()`
    SELECT id FROM users WHERE id = ${userId} LIMIT 1
  `;
  expect(usersLeft.length).toBe(0);

  const modulesLeft = await db()`
    SELECT id FROM modules_config WHERE user_id = ${userId} LIMIT 1
  `;
  expect(modulesLeft.length).toBe(0);
});
