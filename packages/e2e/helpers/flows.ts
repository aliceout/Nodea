import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { waitForActivationLink } from './mailpit.ts';

/**
 * Reusable flow blocks. Each test invokes the relevant block to
 * land in the state it cares about, instead of re-typing the
 * sequence by hand.
 */

const STRONG_PASSWORD = 'Correct-Horse-Battery-Staple-42';

export interface SeededUser {
  email: string;
  password: string;
}

/** Walk through `/register` → magic link in Mailpit → `/login`
 *  → `/flow/home`. Returns the credentials for downstream
 *  assertions. */
export async function registerAndActivate(
  page: Page,
  emailBase: string,
): Promise<SeededUser> {
  // Make each test's email unique so re-runs don't collide on the
  // unique constraint, even if global-setup truncated.
  const email = `${emailBase}-${Date.now()}@example.com`;
  const password = STRONG_PASSWORD;

  // 1. Register form (open mode). The submit button gates on
  // password rules + password === confirm + valid email, so every
  // field must be filled before the click.
  await page.goto('/register');
  await page.getByLabel(/E-?mail/i).fill(email);
  await page.getByLabel(/Nom d.utilisateur|Username/i).fill(emailBase);
  await page.getByLabel(/^Mot de passe$|^Password$/i).fill(password);
  await page.getByLabel(/Confirmer|Confirm/i).fill(password);
  await page.getByRole('button', { name: /Cr.er mon compte|Create account/i }).click();

  // The register flow shows a "check your email" panel and emits
  // the activation email. Wait for it.
  const link = await waitForActivationLink(email);

  // 2. Visit the activation link — Activate.tsx auto-redirects to
  //    /login?activated=1 once the token is consumed.
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?activated=1/);

  // 3. Type the password back to obtain a real session cookie.
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.getByRole('button', { name: /Se connecter|Sign in|Connexion/i }).click();

  // 4. Land on the flow home — proves a `full` session exists.
  await expect(page).toHaveURL(/\/flow(\/home)?/);
  return { email, password };
}

/** Log in an already-activated user. Asserts we land on /flow. */
export async function login(page: Page, user: SeededUser): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type=email]', user.email);
  await page.fill('input[type=password]', user.password);
  await page.getByRole('button', { name: /Se connecter|Sign in|Connexion/i }).click();
  await expect(page).toHaveURL(/\/flow(\/home)?/);
}

/** Log out via the menu. */
export async function logout(page: Page): Promise<void> {
  // The logout button is reachable from the sidebar / menu — most
  // direct path is to call the API. Use the route directly.
  await page.goto('/login');
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
}
