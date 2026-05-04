import { test, expect } from '@playwright/test';

import {
  backdateBypassConfirmation,
  getUserIdByEmail,
} from '../helpers/db.ts';
import {
  clearInbox,
  waitForActivationLink,
  waitForBypassConfirmLink,
} from '../helpers/mailpit.ts';
import { totpCode } from '../helpers/totp.ts';

/**
 * MFA bypass — récupération quand l'utilisateur a perdu son TOTP.
 *
 * Flow exercé end-to-end (cf. Auth-Spec §7.8) :
 *
 *   1. Register + activate.
 *   2. Activer TOTP via `/totp` (réutilise le pattern de la spec 02).
 *   3. Passer security_mode en `always_totp` via `/security-mode`
 *      pour que le TOTP soit obligatoire à chaque login. Sans ça
 *      le bypass n'a rien à bypasser.
 *   4. Logout.
 *   5. Login → land sur `/login/mfa` (session `mfa_pending`).
 *   6. Cliquer « J'ai perdu mon TOTP → utiliser un code de secours »,
 *      puis « Demander une récupération par email », puis
 *      « Envoyer l'email ».
 *   7. Mailpit attrape l'email, on extrait le lien de confirmation.
 *   8. Visiter le lien → server marque le bypass `confirmed_at`.
 *   9. `backdateBypassConfirmation()` shifte le timestamp à -8 jours
 *      pour simuler la fenêtre de 7 jours écoulée.
 *  10. Logout pour clear la `mfa_pending`, re-login. Cette fois le
 *      serveur consomme le bypass au login finish et émet une
 *      session `full` directement, sans page MFA.
 *
 * La fenêtre de 7 jours est l'anti-attaque : si quelqu'un a volé
 * une session pour faire la demande, l'utilisateur a 7 jours pour
 * la voir / l'annuler depuis Settings avant qu'elle s'applique.
 * Le helper DB `backdateBypassConfirmation` saute cette attente.
 */

const STRONG_PASSWORD = 'Correct-Horse-Battery-Staple-42';

test.beforeEach(async () => {
  await clearInbox();
});

test('MFA bypass TOTP — perte de TOTP → email de récupération → re-login sans TOTP', async ({ page }) => {
  const email = `bypass-${Date.now()}@example.com`;
  const username = `bypass${Date.now()}`;

  /* -------- 1. Register + activate -------- */
  await page.goto('/register');
  await expect(
    page.getByRole('button', { name: /Cr.er mon compte|Create account/i }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/Identifiant|Username/i).fill(username);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  const confirmField = page.getByLabel(/Confirmer|Confirm/i);
  if (await confirmField.count() > 0) {
    await confirmField.fill(STRONG_PASSWORD);
  }
  await page.getByRole('button', { name: /Cr.er mon compte|Create account/i }).click();
  const activationLink = await waitForActivationLink(email);
  await page.goto(activationLink);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 2. Activer TOTP via /totp (pattern spec 02) -------- */
  await page.goto('/totp');
  await page.getByRole('button', { name: /Activer/i }).click();
  await page
    .getByLabel(/^Mot de passe.*actuel|Current password/i)
    .fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Scrape le secret base32 affiché.
  const secretLocator = page
    .locator('[data-testid=totp-secret], code, pre')
    .filter({ hasText: /^[A-Z2-7]{16,}$/ });
  await expect(secretLocator.first()).toBeVisible({ timeout: 10_000 });
  const secret =
    (await secretLocator.first().textContent())?.replace(/\s+/g, '') ?? '';
  expect(secret.length).toBeGreaterThanOrEqual(16);

  // Génère le code matchant et confirme.
  const enrollCode = await totpCode(secret);
  await page.getByLabel(/Code|TOTP/i).fill(enrollCode);
  const ack = page.getByRole('checkbox', { name: /noté|saved|sauvegardé/i });
  if (await ack.count() > 0) await ack.check();
  await page
    .getByRole('button', { name: /Activer|Verify|Confirmer/i })
    .click();
  await expect(page.getByText(/désactiver|disable/i)).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 3. Passer security_mode → always_totp -------- */
  await page.goto('/security-mode');
  // Cliquer la carte « TOTP requis » — mode `always_totp`.
  await page
    .getByRole('button', { name: /TOTP requis|Require TOTP/i })
    .first()
    .click();
  // Le formulaire de proof de mot de passe apparaît.
  await page
    .getByPlaceholder(/Mot de passe|Password/i)
    .first()
    .fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Confirmer$|^Confirm$/i })
    .first()
    .click();
  // Attendre le feedback de succès « Mode mis à jour ».
  await expect(page.getByText(/Mode mis à jour|Mode updated/i)).toBeVisible({
    timeout: 10_000,
  });

  /* -------- 4. Logout -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  /* -------- 5. Login → land sur /login/mfa -------- */
  await page.goto('/login');
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();
  await expect(page).toHaveURL(/\/login\/mfa/, { timeout: 10_000 });

  /* -------- 6. Demander la récupération par email -------- */
  // Première escalation : passer du code TOTP au mode backup.
  await page
    .getByRole('button', { name: /J.ai perdu mon TOTP|lost my TOTP/i })
    .first()
    .click();
  // Deuxième escalation : demander la récupération par email.
  await page
    .getByRole('button', {
      name: /Demander une récupération par email|Request email recovery/i,
    })
    .first()
    .click();
  // Confirmer l'envoi (LostFlow `confirm` step).
  await page
    .getByRole('button', { name: /Envoyer l.email|Send email/i })
    .first()
    .click();

  /* -------- 7. Récupérer le lien Mailpit -------- */
  const bypassLink = await waitForBypassConfirmLink(email);

  /* -------- 8. Visiter le lien → confirmer le bypass -------- */
  await page.goto(bypassLink);
  // BypassConfirm/SuccessPanel.tsx affiche le succès. On accepte
  // toute URL sous /auth/bypass/* qui rend (la page peut rester
  // sur le confirm path ou rediriger).
  await expect(page).toHaveURL(/\/auth\/bypass/, { timeout: 10_000 });

  /* -------- 9. Time-shift le confirmed_at à -8 jours -------- */
  const userId = await getUserIdByEmail(email);
  expect(userId).not.toBeNull();
  await backdateBypassConfirmation(userId!);

  /* -------- 10. Logout + re-login → land directement sur /flow -------- */
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  await page.goto('/login');
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /Se connecter|Sign in|Connexion/i })
    .click();

  // Le bypass est consommé au login finish — pas de page MFA, on
  // atterrit directement sur /flow. Si on landait sur /login/mfa,
  // c'est que la consommation du bypass a échoué (régression).
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
