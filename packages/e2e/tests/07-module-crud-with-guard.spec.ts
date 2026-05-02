import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Module CRUD — proves the full encrypt → write → read → update →
 * delete cycle works on a real module, with the X-Sid / X-Guard
 * headers in place (post-SEC-01) and the guard middleware accepting
 * each mutation.
 *
 * Picked Mood as the simplest module : a numeric score (-2..+2), 3
 * positives (text), and an optional Q&A. No streaming, no covers,
 * no series — minimal selectors to manage.
 *
 * Sequence :
 *   1. Register + activate, land on /flow.
 *   2. Open the Mood module via the sidebar — the first-run hook
 *      seeds `modules_config` lazily on first navigation.
 *   3. Open the global Composer ("+ Nouvelle entrée") in mood mode.
 *   4. Fill 3 positives + a score, save. Entry must appear in the
 *      list.
 *   5. Edit (pencil icon) → tweak the first positive → save. Updated
 *      text must appear.
 *   6. Delete (trash icon) → accept the window.confirm dialog.
 *      Entry must disappear from the list.
 *
 * If any step's API call were rejected by the guard middleware
 * (X-Sid / X-Guard header missing or wrong shape), the entry would
 * never appear / never update / never delete — so the assertions
 * in steps 4-6 implicitly cover the « with guard » contract.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('module CRUD — Mood: create → read → update → delete', async ({ page }) => {
  /* -------- 1. Register + land on /flow -------- */
  await registerAndActivate(page, 'modcrud');

  /* -------- 2. Open Mood module via sidebar -------- */
  // Sidebar nav exposes module entries by name. Mood is « Humeur »
  // in FR or « Mood » in EN.
  await page
    .getByRole('button', { name: /^Humeur$|^Mood$/i })
    .first()
    .click();
  // First-run seed lands the user on the module's primary view.
  // Wait for the heatmap / list anchor to mount before continuing.
  await page.waitForLoadState('networkidle');

  /* -------- 3. Open the Composer in mood mode -------- */
  await page
    .getByRole('button', { name: /\+\s*Nouvelle entrée|\+\s*New entry/i })
    .first()
    .click();
  // The Composer opens in modal — for a freshly-seeded user, the
  // first picker may show types ; click « Humeur » / « Mood » to
  // route into the mood body.
  const moodTypePicker = page.getByRole('button', {
    name: /^Humeur$|^Mood$/i,
  });
  if (await moodTypePicker.count() > 1) {
    // The sidebar entry + the composer picker share the same name —
    // last() targets the composer one.
    await moodTypePicker.last().click();
  }

  /* -------- 4. Fill + save -------- */
  // The 3 positives are the first 3 text inputs in the composer
  // body. Use placeholder hints when present.
  const positives = page.locator(
    'input[placeholder*=positif i], input[placeholder*=positive i], textarea[placeholder*=positif i], textarea[placeholder*=positive i]',
  );
  // If placeholder targeting fails, fall back to the first 3 text
  // inputs in the modal.
  const count = await positives.count();
  if (count >= 3) {
    await positives.nth(0).fill('Café du matin');
    await positives.nth(1).fill('Soleil');
    await positives.nth(2).fill('Bonne nuit');
  } else {
    const fallback = page.locator('input[type=text]');
    await fallback.nth(0).fill('Café du matin');
    await fallback.nth(1).fill('Soleil');
    await fallback.nth(2).fill('Bonne nuit');
  }
  // Score buttons : -2, -1, 0, +1, +2. Click +1.
  await page.getByRole('button', { name: /^\+?1$/ }).first().click();
  // Save.
  await page
    .getByRole('button', { name: /^Enregistrer$|^Save$/i })
    .click();

  // Entry must appear in the list — search for the first positive.
  await expect(page.getByText('Café du matin').first()).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 5. Edit → tweak first positive → save -------- */
  // Hover the first row to reveal the action icons. Pencil = edit.
  const editIcon = page.getByRole('button', { name: /Modifier|Edit/i });
  await editIcon.first().click();
  // Composer reopens with prefilled fields.
  const firstPositive = page
    .locator('input, textarea')
    .filter({ hasText: /Café du matin/ });
  // Some inputs surface their value via the `value` attribute, not
  // children — fall back to the first text input which we know is
  // the first positive.
  if (await firstPositive.count() === 0) {
    const fallback = page.locator('input[type=text]').first();
    await fallback.fill('Café du matin (mis à jour)');
  } else {
    await firstPositive.first().fill('Café du matin (mis à jour)');
  }
  await page
    .getByRole('button', { name: /^Enregistrer$|^Save$|Mettre à jour|Update/i })
    .click();

  await expect(page.getByText('Café du matin (mis à jour)').first()).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 6. Delete → accept confirm dialog -------- */
  // Auto-accept the window.confirm fired by the trash button.
  page.once('dialog', (dialog) => dialog.accept().catch(() => undefined));

  const deleteIcon = page.getByRole('button', { name: /Supprimer|Delete/i });
  await deleteIcon.first().click();

  await expect(
    page.getByText('Café du matin (mis à jour)').first(),
  ).toBeHidden({ timeout: 10_000 });
});
