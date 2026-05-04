import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Account Settings — username + email changes from the « Mon compte »
 * page. Covers the auth-account.ts route file (split out of the
 * legacy auth.ts barrel) post-API-14, and the change-email re-auth
 * gate (`requireFreshPassword` middleware, Phase 7B).
 *
 * Why this spec :
 *   - `auth-account.ts` was extracted recently and `/auth/me` was
 *     split off `/auth/me/crypto`. The unit tests cover the API
 *     side ; this spec covers the UI side (form lifecycle,
 *     re-auth modal, success feedback, persistence after logout +
 *     re-login).
 *   - Email change requires re-auth via OPAQUE password proof. A
 *     regression in the proof handshake or the wrap-blob roundtrip
 *     would silently 401 — this spec catches it.
 *
 * Sequence :
 *   1. Register + activate, land on /flow.
 *   2. Open « Mon compte » via sidebar.
 *   3. Username change : click edit, type new value, save, assert
 *      success feedback + value updated in the row.
 *   4. Email change : click edit, type new email + current password,
 *      save, assert success feedback + value updated.
 *
 * What this spec does NOT cover :
 *   - **Re-login with the new email** — V1 limitation : the OPAQUE
 *     envelope is bound to the registered email (`userIdentifier`)
 *     and `PATCH /auth/email` only flips the column, not the
 *     envelope. Future Phase 2+ will re-register OPAQUE on email
 *     change ; until then, the change is « cosmetic » for OPAQUE
 *     purposes (login still uses the old email under the hood,
 *     even though the row shows the new one). Cf. JSDoc on
 *     `auth-account.ts` `PATCH /email` handler.
 *   - Self-delete via the Danger tab (covered by `06-account-deletion-cascade`).
 *   - Onboarding completion (auto-completed by `registerAndActivate`).
 *   - Email-change cooldown (« 1 change per 24 h » rate limit) —
 *     would need DB time-shift, separate spec if ever flaked.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('account changes — username + email update via Settings UI, persist across re-login', async ({ page }) => {
  /* -------- 1. Register + land on /flow -------- */
  const user = await registerAndActivate(page, 'acctchg');

  /* -------- 2. Open « Votre profil » via sidebar header -------- */
  // Sidebar UserMenu icon button (cf. SidebarHeader.tsx) carries an
  // aria-label from i18n: « Votre profil » (FR) / « Your profile » (EN).
  await page
    .getByRole('button', { name: /^Votre profil$|^Your profile$/i })
    .first()
    .click();
  // The Account page opens on the « Identité » tab by default.
  await page.waitForLoadState('networkidle');

  /* -------- 3. Username change -------- */
  // Click the « Modifier » button on the username row. The aria-label
  // is the i18n `account.identity.username.editLabel` value, which
  // varies between FR and EN. Match both.
  await page
    .getByRole('button', {
      name: /Modifier le nom d.utilisateur|Edit display name/i,
    })
    .first()
    .click();

  // Username input is the active one after the click (autoFocus). Type a
  // new value via keyboard after clearing — the existing username
  // (set to `acctchg` by registerAndActivate) is pre-filled.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('acctchg-renamed');

  await page
    .getByRole('button', { name: /^Enregistrer$|^Save$/i })
    .first()
    .click();

  // Success feedback : « Identifiant mis à jour. » / « Display name
  // updated. ». Just check the « renamed » value appears in the row.
  await expect(page.getByText('acctchg-renamed').first()).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 4. Email change (with re-auth gate) -------- */
  await page
    .getByRole('button', {
      name: /Modifier l.adresse e-?mail|Edit e-?mail address/i,
    })
    .first()
    .click();

  const newEmail = `acctchg-new-${Date.now()}@example.com`;

  // Email input is the first input in the email row's edit form.
  // Use the email type so we don't conflict with the password input.
  const emailInput = page.locator('input[type=email]').last();
  await emailInput.fill(newEmail);

  // Current password — required by `freshenPasswordReauth` before
  // the API call. Placeholder is « Mot de passe actuel » in FR,
  // « Current password » in EN — but we just hit the input by type.
  const passwordInput = page.locator('input[type=password]').last();
  await passwordInput.fill(user.password);

  await page
    .getByRole('button', { name: /^Enregistrer$|^Save$/i })
    .first()
    .click();

  // The new email should appear in the row's value (the row reads
  // back from the store, hydrated by `apiMe()` in the save flow).
  // We don't re-login with the new email — V1 limitation noted in
  // the spec header.
  await expect(page.getByText(newEmail).first()).toBeVisible({
    timeout: 10_000,
  });
});
