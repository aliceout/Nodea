import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Goals CRUD — second module CRUD spec, mirror of `07-module-crud-with-guard`
 * (Mood). The two together cover the full encrypted-collection contract
 * (X-Sid + X-Guard headers, init guard promotion, AAD bindings) on the
 * two modules considered « finis » today (Mood + Goals).
 *
 * Why a second module spec rather than parametrising the existing one :
 * Goals has a distinct UI (3-button status toggle, month+year split, no
 * score) so the selectors don't carry over. Keeping two short specs is
 * easier to read and to debug than one specs that branches on module.
 *
 * Sequence :
 *   1. Register + activate, land on /flow.
 *   2. Open the Goals module via the sidebar.
 *   3. Click `+ Nouvel objectif` / `+ New goal` to open the Composer in
 *      goal mode.
 *   4. Fill title + click status « Ouvert ». Save.
 *   5. Entry must appear in the list.
 *   6. Edit (pencil icon, `Modifier l'objectif`) → tweak title → save.
 *   7. Updated text must appear.
 *   8. Delete (trash icon, `Supprimer l'objectif`) → accept confirm.
 *   9. Entry must disappear from the list.
 *
 * The goal status flow is exercised by the Mood spec's score click already,
 * so this spec doesn't double down on it — we save with the default
 * « Ouvert » status. The completedAt boundary logic (flip-into-done seeds
 * `now`, flip-out clears) has its own unit-test coverage in
 * `bodies/goal/save-payload.ts` round-trips.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('module CRUD — Goals: create → read → update → delete', async ({ page }) => {
  /* -------- 1. Register + land on /flow -------- */
  await registerAndActivate(page, 'goals');

  /* -------- 2. Open Goals module via sidebar -------- */
  // Sidebar entry — the FR + EN i18n catalogue both keep « Goals » as
  // the module title (recognisable English brand).
  await page
    .getByRole('button', { name: /^Goals$/i })
    .first()
    .click();
  // First-run seed lands the user on the module's primary view.
  // Wait for the goals list / empty state to mount.
  await page.waitForLoadState('networkidle');

  /* -------- 3. Open Composer via topbar « + Nouvel objectif » -------- */
  // Goals uses its own CTA label (not the generic « + Nouvelle entrée »
  // — see fr/en `goals.json` `topbar.newCta`).
  await page
    .getByRole('button', { name: /\+\s*Nouvel objectif|\+\s*New goal/i })
    .first()
    .click();

  /* -------- 4. Fill title + save -------- */
  // The title input autoFocuses on Composer open. We type into the
  // active element rather than picking by placeholder to stay robust
  // to i18n changes.
  await page.keyboard.type('Lancer un blog');

  // Save — Composer footer label is « Enregistrer » (FR common.actions.save).
  await page
    .getByRole('button', { name: /^Enregistrer$|^Save$/i })
    .click();

  // Entry must appear in the goals list.
  await expect(page.getByText('Lancer un blog').first()).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 5. Edit → tweak title → save -------- */
  // The pencil icon carries `aria-label="Modifier l'objectif"` (FR) /
  // `"Edit goal"` (EN) — see GoalRow.tsx.
  await page
    .getByRole('button', { name: /Modifier l.objectif|Edit goal/i })
    .first()
    .click();

  // Composer reopens with title prefilled. The title input is the
  // first text input in the modal — clear and retype.
  const titleInput = page.locator('input[type=text]').first();
  await titleInput.fill('Lancer un blog (mis à jour)');

  await page
    .getByRole('button', { name: /^Mettre à jour$|^Update$|^Enregistrer$|^Save$/i })
    .click();

  await expect(page.getByText('Lancer un blog (mis à jour)').first()).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 6. Delete → accept confirm dialog -------- */
  page.once('dialog', (dialog) => dialog.accept().catch(() => undefined));

  await page
    .getByRole('button', { name: /Supprimer l.objectif|Delete goal/i })
    .first()
    .click();

  await expect(
    page.getByText('Lancer un blog (mis à jour)').first(),
  ).toBeHidden({ timeout: 10_000 });
});
