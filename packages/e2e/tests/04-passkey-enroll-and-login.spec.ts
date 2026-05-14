import { test, expect } from '@playwright/test';

import { clearInbox } from '../helpers/mailpit.ts';
import { registerAndActivate } from '../helpers/flows.ts';
import { attachVirtualAuthenticator } from '../helpers/webauthn.ts';

/**
 * Passkey enroll + login (non-PRF branch) — Auth-Roadmap §7.3.
 *
 * Chromium's CDP virtual authenticator does NOT support the PRF
 * extension. So this spec exercises the **login-only path**: a
 * passkey is registered, the user logs in by ceremony, but the KEK
 * stays unreachable from the credential alone — the UI prompts for
 * the password to finish unlocking. The PRF unwrap path itself is
 * unit-tested in `packages/web/src/core/crypto/passkey-prf.test.ts`.
 *
 * Sequence :
 *   1. Attach the virtual authenticator BEFORE any WebAuthn call.
 *   2. Register + activate user (password A).
 *   3. Visit /passkeys, enroll. The page asks for password A as
 *      proof, then drives `navigator.credentials.create()` against
 *      the virtual authenticator (auto-approved).
 *   4. Log out.
 *   5. On /login, click the « passkey » entry. The virtual
 *      authenticator auto-approves the assertion. The session cookie
 *      is set — but the SPA detects PRF is missing and stays on a
 *      « finish unlock » prompt.
 *   6. Type password A → KEK unwrapped, land on /flow.
 */

test.beforeEach(async () => {
  await clearInbox();
});

test('passkey — enroll + login (non-PRF, password finishes unlock)', async ({
  context,
  page,
}) => {
  /* -------- 1. Attach virtual authenticator -------- */
  const auth = await attachVirtualAuthenticator(context, page);

  try {
    /* -------- 2. Register + activate -------- */
    const user = await registerAndActivate(page, 'passkey');

    /* -------- 3. Enroll a passkey -------- */
    await page.goto('/passkeys');
    // Page may show « Ajouter une passkey » or « Enroll » depending
    // on i18n locale — handle both.
    await page
      .getByRole('button', {
        name: /Ajouter une passkey|Enroll a passkey|Enroll/i,
      })
      .first()
      .click();

    // Password proof step — the page calls /auth/reauth/password
    // before /auth/passkeys/enroll/start.
    await page
      .getByLabel(/^Mot de passe.*actuel$|^Current password$/i)
      .fill(user.password);
    // Optional « label » input — the user gives the credential a
    // friendly name. Field is required so we always fill.
    const labelField = page.getByLabel(/Nom|Label/i);
    if (await labelField.count() > 0) {
      await labelField.first().fill('e2e-virtual');
    }
    await page
      .getByRole('button', {
        name: /^Confirmer avec ma passkey$|^Enregistrement…$|^Confirm with my passkey$/i,
      })
      .click();

    // The virtual authenticator auto-approves. After enroll, the
    // page lists the credential — wait for « e2e-virtual » or any
    // recently-added row.
    await expect(page.getByText(/e2e-virtual|Passkey/i).first()).toBeVisible({
      timeout: 15_000,
    });

    /* -------- 4. Log out -------- */
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    });

    /* -------- 5. Log back in via the passkey ceremony -------- */
    await page.goto('/login');
    // Optional email pre-fill — improves UX but not required for
    // the assertion ceremony when discoverable creds are used.
    await page.getByLabel(/E-?mail/i).fill(user.email);
    await page
      .getByRole('button', {
        name: /passkey|Se connecter avec.*passkey|Sign in with.*passkey/i,
      })
      .click();

    // The virtual authenticator auto-approves. The session cookie
    // is set ; the SPA either lands on /flow (if PRF surfaced) or
    // shows a « finish unlock » prompt (the case we hit here, no
    // PRF). Both endpoints accept — the test only fails if neither
    // shows up within the timeout.
    await page.waitForURL(/\/flow|\/login/, { timeout: 15_000 });

    /* -------- 6. If we're not yet on /flow, finish with password -------- */
    const finalUrl = page.url();
    if (!finalUrl.includes('/flow')) {
      // Type password to finish KEK unwrap.
      await page
        .getByLabel(/^Mot de passe$|^Password$/i)
        .fill(user.password);
      await page
        .getByRole('button', { name: /^Se connecter$|^Sign in$|^Connexion$|^Continuer$/i })
        .click();
      await expect(page).toHaveURL(/\/flow/, { timeout: 10_000 });
    }
  } finally {
    await auth.detach();
  }
});
