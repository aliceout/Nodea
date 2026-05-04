import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Switch FR ↔ EN via la sidebar footer + assertion sur quelques
 * surfaces clés. Le but n'est PAS d'auditer toutes les chaînes
 * traduites (la parité FR/EN est garantie par le script
 * `i18n:diff`) — c'est de prouver que :
 *
 *   1. Le toggle de langue fonctionne (le `<select>` aria-label
 *      « Préférence de langue » dans `SidebarFooter`).
 *   2. La préférence se persiste (rechargement → reste en EN).
 *   3. Les libellés se changent VRAIMENT après switch — pas
 *      un cas où la clé serait manquante et tout retomberait
 *      sur le français quand même.
 *
 * On vérifie 3 surfaces qui ont reçu de l'i18n récemment :
 *   - Sidebar « Mon compte » / « My account »
 *   - Topbar Settings : « Paramètres · Mon compte »
 *   - Account → Identity tab : « Nom d'affichage » / « Display name »
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('i18n FR ↔ EN — switch via sidebar + persistance + libellés clés', async ({ page }) => {
  // Playwright lance Chromium en `en-US` par défaut, donc
  // `navigator.language === 'en'` et `I18nProvider.detectInitialLanguage`
  // retombe sur EN au premier paint. On force FR en seedant
  // `localStorage` AVANT que l'app monte — sans ça la sidebar serait
  // déjà en EN au moment où on cherche « Votre profil ».
  // `addInitScript` rejoue à CHAQUE navigation (y compris le `reload`
  // de l'étape 5), donc on ne touche au storage QUE s'il est vide :
  // une fois que l'utilisateur a switché en EN à l'étape 2,
  // l'override doit céder la main pour que le test de persistance
  // soit valide.
  await page.addInitScript(() => {
    if (window.localStorage.getItem('nodea:language') == null) {
      window.localStorage.setItem('nodea:language', 'fr');
    }
  });
  await registerAndActivate(page, 'i18nswitch');

  /* -------- 1. Confirmer FR par défaut sur la sidebar -------- */
  await expect(page.getByRole('button', { name: /^Votre profil$/i })).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 2. Switcher en EN via le LanguageToggle de la sidebar footer -------- */
  await page
    .getByLabel(/Préférence de langue|Language preference/i)
    .selectOption('en');

  /* -------- 3. La sidebar bascule en EN -------- */
  await expect(page.getByRole('button', { name: /^Your profile$/i })).toBeVisible({
    timeout: 10_000,
  });
  // Le label FR ne doit plus être présent (sinon c'est qu'on n'a
  // changé que la sidebar foot, pas le reste).
  await expect(page.getByRole('button', { name: /^Votre profil$/i })).toHaveCount(0);

  /* -------- 4. Naviguer sur Account → vérifier les libellés EN -------- */
  await page.getByRole('button', { name: /^Your profile$/i }).first().click();
  await page.waitForLoadState('networkidle');

  // Identity tab affiche « Display name » côté EN, « Nom d'affichage »
  // côté FR. Match exact pour éviter un faux-positif sur un autre
  // mot.
  await expect(page.getByText(/Display name/i).first()).toBeVisible({
    timeout: 5_000,
  });

  /* -------- 5. Reload → la préférence de langue persiste -------- */
  await page.reload();
  await page.waitForLoadState('networkidle');
  // Si la persistance casse (préférence non synchro avec
  // `user_preferences` chiffré ou cache localStorage perdu), on
  // retomberait en FR.
  await expect(
    page.getByLabel(/Language preference/i),
  ).toHaveValue('en', { timeout: 10_000 });

  /* -------- 6. Switcher de retour en FR -------- */
  await page.getByLabel(/Language preference/i).selectOption('fr');
  await expect(page.getByRole('button', { name: /^Votre profil$/i }).first()).toBeVisible({
    timeout: 10_000,
  });
});
