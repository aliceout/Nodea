import { test, expect } from '@playwright/test';

import {
  getUserIdByEmail,
  promoteToAdmin,
} from '../helpers/db.ts';
import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Admin → Annonces : créer / activer-désactiver / supprimer.
 *
 * Couvre les routes `/admin/announcements` (qui ont été splittées
 * dans `admin-announcements.ts` au chantier de découpage récent)
 * et la page `AnnouncementsManager` (qui a reçu un sweep i18n
 * dans le même cycle, ~21 nouvelles clés sous
 * `admin.announcementsManager.*`).
 *
 * Setup : le register classique crée un user de rôle `user` ; on
 * promote via SQL (`promoteToAdmin` dans `helpers/db.ts`) puis on
 * reload pour que `/auth/me` rafraîchisse le rôle côté client et
 * que la sidebar ajoute l'entrée Admin.
 *
 * Sequence :
 *   1. Register + activate.
 *   2. Promote → reload.
 *   3. Sidebar → Admin → onglet « Annonces ».
 *   4. Créer une annonce (titre + message → Publier).
 *   5. Vérifier qu'elle apparaît dans la liste avec le statut
 *      « actif » et un bouton « Désactiver ».
 *   6. Cliquer « Désactiver » → status passe à « inactif »,
 *      bouton devient « Activer ».
 *   7. Cliquer « Activer » → retour à « actif » / « Désactiver ».
 *   8. Cliquer le bouton trash (aria-label « Supprimer ») →
 *      confirm dialog, accepter.
 *   9. Vérifier que l'annonce disparaît de la liste.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('admin announcements — create + toggle active + delete', async ({ page }) => {
  /* -------- 1. Register + activate -------- */
  const user = await registerAndActivate(page, 'adminann');

  /* -------- 2. Promote → reload pour que /me ramène le nouveau rôle -------- */
  const userId = await getUserIdByEmail(user.email);
  expect(userId).not.toBeNull();
  await promoteToAdmin(userId!);
  await page.reload();
  await page.waitForLoadState('networkidle');

  /* -------- 3. Sidebar → Admin → Annonces -------- */
  // Le label sidebar est « Admin » identique en FR et EN.
  await page
    .getByRole('button', { name: /^Admin$/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle');

  // Onglet « Annonces ». Les tabs admin n'ont pas encore reçu d'i18n
  // (label en dur dans index.tsx), donc on match juste le FR.
  await page
    .getByRole('button', { name: /^Annonces$/ })
    .first()
    .click();

  /* -------- 4. Créer une annonce -------- */
  const announcementTitle = `Test annonce ${Date.now()}`;
  const announcementBody = 'Corps de test de l\'annonce e2e';

  // Input titre — match par placeholder « Titre ».
  await page.getByPlaceholder(/^Titre$|^Title$/).fill(announcementTitle);
  // Textarea message — placeholder « Message ».
  await page.getByPlaceholder(/^Message$/).fill(announcementBody);

  // Bouton « Publier » — disabled tant que les deux champs sont
  // vides ; on les a remplis donc il s'active.
  await page
    .getByRole('button', { name: /^Publier$|^Publish$/ })
    .click();

  /* -------- 5. Vérifier l'apparition + statut « actif » -------- */
  await expect(page.getByText(announcementTitle).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/\bactif\b|\bactive\b/i).first()).toBeVisible({
    timeout: 5_000,
  });

  /* -------- 6. Toggle Désactiver -------- */
  await page
    .getByRole('button', { name: /^Désactiver$|^Deactivate$/ })
    .first()
    .click();
  await expect(page.getByText(/\binactif\b|\binactive\b/i).first()).toBeVisible({
    timeout: 5_000,
  });

  /* -------- 7. Toggle Activer -------- */
  await page
    .getByRole('button', { name: /^Activer$|^Activate$/ })
    .first()
    .click();
  await expect(page.getByText(/\bactif\b|\bactive\b/i).first()).toBeVisible({
    timeout: 5_000,
  });

  /* -------- 8. Delete avec confirm -------- */
  page.once('dialog', (dialog) => dialog.accept().catch(() => undefined));

  // Bouton trash — aria-label « Supprimer ». Il y a un seul bouton
  // « Supprimer » par row d'annonce — on prend le premier.
  await page
    .getByRole('button', { name: /^Supprimer$|^Delete$/ })
    .first()
    .click();

  /* -------- 9. L'annonce doit disparaître -------- */
  await expect(page.getByText(announcementTitle).first()).toBeHidden({
    timeout: 10_000,
  });
});
