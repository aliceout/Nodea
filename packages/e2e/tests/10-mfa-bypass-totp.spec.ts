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
 *   3. Passer security_mode en `always_2fa` via `/security-mode`
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
    page.getByRole('button', { name: /^Cr.er mon compte$|^Create account$/i }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Nom d.utilisateur.*$|^Username$/i).fill(username);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  const confirmField = page.getByLabel(/Confirmer|Confirm/i);
  if (await confirmField.count() > 0) {
    await confirmField.fill(STRONG_PASSWORD);
  }
  await page.getByRole('button', { name: /^Cr.er mon compte$|^Create account$/i }).click();
  const activationLink = await waitForActivationLink(email);
  await page.goto(activationLink);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
    .click();
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });

  /* -------- 2. Activer TOTP via /totp (pattern spec 02) -------- */
  await page.goto('/totp');
  // ListView (disabled state) — single form (cf. Totp/ListView.tsx).
  await page
    .getByLabel(/^Mot de passe actuel$|^Current password$/i)
    .fill(STRONG_PASSWORD);
  await page
    .getByRole('button', { name: /^Activer TOTP$|^Enable TOTP$/i })
    .click();

  // SecretPanel — reveal the masked base32 then scrape via data-testid.
  await page
    .getByRole('button', { name: /^Afficher la cl.$|^Reveal the key$/i })
    .click();
  const secretLocator = page.locator('[data-testid=totp-secret]');
  await expect(secretLocator).toBeVisible({ timeout: 10_000 });
  const secret =
    (await secretLocator.textContent())?.replace(/\s+/g, '') ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  const enrollCode = await totpCode(secret);
  await page.getByLabel(/^Code à 6 chiffres/i).fill(enrollCode);
  await page.getByRole('button', { name: /^Activer$|^Activation…$/i }).click();

  // BackupCodesPanel — ack + « Terminé ».
  await page
    .getByRole('checkbox', { name: /not.|saved|sauvegard./i })
    .check();
  await page.getByRole('button', { name: /^Terminé$|^Done$/i }).click();

  // Back on the enabled-state ListView.
  await expect(
    page.getByRole('button', { name: /^Désactiver TOTP$|^Disable TOTP$/i }),
  ).toBeVisible({ timeout: 10_000 });

  /* -------- 3. Vérifier que security_mode est déjà always_2fa -------- */
  // Pas besoin de switcher manuellement : l'API `auth-totp.ts`
  // auto-promote `security_mode` de `password_or_passkey` à
  // `always_2fa` au moment où on verify l'enroll (cf.
  // `routes/auth-totp.ts:278`). On confirme juste que la carte
  // « TOTP requis » est marquée comme courante (`aria-pressed=true`)
  // pour qu'on n'envoie pas le test sur la suite si l'auto-promotion
  // a régressé.
  await page.goto('/security-mode');
  await expect(
    page.getByRole('button', { name: /TOTP requis/ }).first(),
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

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
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
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
  // BypassConfirm appelle l'API en useEffect — on attend que le
  // SuccessPanel rende (« Demande validée » / « Demande déjà
  // confirmée »), preuve que `confirmed_at` est bien posé en DB.
  // Sans ça, le `backdateBypassConfirmation` qui suit court le
  // risque de tourner avant le `UPDATE confirmed_at = now`, ne
  // matcherait aucune ligne (filtre `confirmed_at IS NOT NULL`),
  // et le re-login échouerait — le bypass jamais consumable.
  await expect(
    page.getByText(/Demande validée|Demande déjà confirmée/),
  ).toBeVisible({ timeout: 10_000 });

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
    .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$/i })
    .click();

  // Le bypass est consommé au login finish — pas de page MFA, on
  // atterrit directement sur /flow. Si on landait sur /login/mfa,
  // c'est que la consommation du bypass a échoué (régression).
  await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
});
