import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';

/**
 * Invariants de privacy figés dans CLAUDE.md (§ Routing) :
 *
 *   1. **L'URL reste `/flow`** quel que soit le module actif.
 *      Pas de `/flow/mood`, `/flow?subview=...`, `?tab=...`. Le
 *      module actif vit dans le store Zustand uniquement — le
 *      serveur ne voit jamais lequel l'utilisateur consulte
 *      via les access logs nginx ou le request logger.
 *
 *   2. **`document.title === 'Nodea'`** sur tout le périmètre
 *      authentifié. Pas de `« Mood — Nodea »` ou `« Goals —
 *      Nodea »` qui leak dans tous les outils de capture
 *      d'écran, plugins « what's on my screen », et la liste
 *      des onglets du browser. Les pages publiques (`/login`,
 *      `/docs`, etc.) PEUVENT setter un title — l'invariant ne
 *      vise que `/flow`.
 *
 *   3. **Aucun token / guard / sid ne doit apparaître dans une
 *      URL** (SEC-01). Les query strings `?token=`, `?d=`
 *      (legacy guard), `?sid=` sont interdits sur tout le
 *      périmètre authentifié. Le guard HMAC est du matériel
 *      cryptographique — il voyage dans `X-Guard` / `X-Sid`
 *      headers, jamais en clair dans l'URL où il finirait dans
 *      les access logs.
 *
 * Le test exerce les 3 invariants à la suite : navigue sur
 * plusieurs modules via la sidebar, ouvre / ferme le composer,
 * et capture toutes les requêtes réseau pour assert sur les
 * query strings.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('privacy invariants — URL stays /flow + title stays Nodea + no token/guard in URLs', async ({ page }) => {
  /* -------- Setup : capturer toutes les requêtes réseau -------- */
  // On collecte chaque URL pour l'asserter en bloc à la fin —
  // plus robuste que matcher par requête, et donne un message
  // d'erreur lisible quand quelque chose leak.
  const capturedUrls: string[] = [];
  page.on('request', (req) => {
    capturedUrls.push(req.url());
  });

  /* -------- 1. Register + land /flow -------- */
  await registerAndActivate(page, 'privacy');

  /* -------- 2. Asserts initiaux : home -------- */
  await expectPathnameAndTitle(page, '/flow');

  /* -------- 3. Naviguer sur Mood -------- */
  await page
    .getByRole('button', { name: /^Mood$/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle');

  // Invariant 1 : URL inchangée. Si on landait sur /flow/mood
  // ou /flow?module=mood, c'est un bug de privacy.
  await expectPathnameAndTitle(page, '/flow');

  /* -------- 4. Naviguer sur Goals -------- */
  await page
    .getByRole('button', { name: /^Goals$/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle');
  await expectPathnameAndTitle(page, '/flow');

  /* -------- 5. Ouvrir / fermer le composer -------- */
  // Le Composer a sa propre logique d'overlay ; il ne devrait
  // PAS modifier l'URL ni le title. Touchstone du « modal-as-state ».
  await page
    .getByRole('button', {
      name: /\+\s*Nouvel objectif|\+\s*New goal|\+\s*Nouvelle entrée/i,
    })
    .first()
    .click();
  await expectPathnameAndTitle(page, '/flow');
  // Fermer via Escape — le composer écoute le keyboard.
  await page.keyboard.press('Escape');
  await expectPathnameAndTitle(page, '/flow');

  /* -------- 6. Retour Home pour clore la navigation -------- */
  // Home label in SidebarNav is hardcoded « Aujourd'hui » (FR-only,
  // not i18n-switched). Apostrophe in DOM is the typographic « ’ »,
  // matched here with `.` to tolerate either form.
  await page
    .getByRole('button', { name: /^Aujourd.hui$/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle');
  await expectPathnameAndTitle(page, '/flow');

  /* -------- 7. Invariant 3 : pas de token/guard/sid en query string -------- */
  // L'invariant porte sur les requêtes qui hitent NOTRE api (= URLs
  // sur le path `/api/` côté SPA, ou directement sur le port 3000)
  // et sur les pages applicatives. Vite dev sert tout l'intérieur
  // de `/src/` et `/node_modules/` avec ses propres `?import` /
  // `?t=<timestamp>` (cache buster HMR) — ces URLs ne touchent
  // jamais le request logger Hono ni les access logs Nginx, donc
  // elles ne sont pas une fuite de privacy au sens du SEC-01.
  // On filtre donc UNIQUEMENT les URLs « applicatives » :
  // celles qui passent par `/api/...` ou les pages SPA bare-path.
  const forbiddenPattern = /[?&](token|t|d|sid|guard)=/i;
  const isApplicationUrl = (url: string): boolean => {
    try {
      const u = new URL(url);
      // Vite dev sert : `/src/...`, `/node_modules/...`,
      // `/@vite/...`, `/@react-refresh`, `/@fs/...`, `/@id/...`
      if (/^\/(?:src|node_modules|@vite|@react-refresh|@fs|@id)\//.test(u.pathname)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };
  const leaks = capturedUrls.filter((url) => {
    if (!isApplicationUrl(url)) return false;
    if (!forbiddenPattern.test(url)) return false;
    // Whitelist : les URLs `/activate?token=…` venant de Mailpit
    // sont en setup, pas une fuite. On les exclut explicitement.
    if (/\/activate\?token=/.test(url)) return false;
    // Idem pour /auth/bypass/confirm?t= (bypass MFA, autre spec).
    if (/\/auth\/bypass\/confirm\?t=/.test(url)) return false;
    // /auth/register/invite-info?token=… : doc-only, lookup public.
    if (/\/auth\/register\/invite-info\?token=/.test(url)) return false;
    return true;
  });

  expect(leaks, `URL(s) avec token/guard/sid en query string :\n${leaks.join('\n')}`)
    .toEqual([]);
});

/**
 * Helper : asserte que `window.location.pathname === expectedPath`
 * ET que `document.title === 'Nodea'`. Centralisé parce qu'on l'appelle
 * 5 fois dans le test.
 */
async function expectPathnameAndTitle(
  page: import('@playwright/test').Page,
  expectedPath: string,
): Promise<void> {
  const { pathname, title } = await page.evaluate(() => ({
    pathname: window.location.pathname,
    title: document.title,
  }));
  expect(pathname).toBe(expectedPath);
  // Le title peut contenir un préfixe (favicon-loader, app name)
  // mais ne doit JAMAIS contenir un nom de module. On match strict
  // sur « Nodea » seul.
  expect(title).toBe('Nodea');
}
