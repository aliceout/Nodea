import type { BrowserContext, Page } from '@playwright/test';

/**
 * WebAuthn virtual authenticator helper for Playwright.
 *
 * Chromium exposes a CDP `WebAuthn` domain that creates a software
 * authenticator — `navigator.credentials.create()` /
 * `navigator.credentials.get()` then resolve against it without any
 * physical hardware. We use it to drive the passkey enroll + login
 * tests end-to-end.
 *
 * **Important limitation**: Chromium's virtual authenticator does
 * NOT support the PRF extension. `clientExtensionResults.prf` will
 * be undefined, the same as a real non-PRF authenticator. So our
 * tests cover the "passkey present, login OK, but PRF missing"
 * branch — they DO NOT exercise the PRF unwrap path. That path is
 * unit-tested in `packages/web/src/core/crypto/passkey-prf.test.ts`
 * separately.
 */
export interface VirtualAuthenticator {
  authenticatorId: string;
  /** Tear down — call in test afterEach to avoid leaking state
   *  between tests when reusing a single browser context. */
  detach: () => Promise<void>;
}

export async function attachVirtualAuthenticator(
  context: BrowserContext,
  page: Page,
): Promise<VirtualAuthenticator> {
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await client.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        // Auto-approve every prompt — the test runner can't click
        // an OS-level passkey UI, this short-circuits it.
        automaticPresenceSimulation: true,
      },
    },
  );
  return {
    authenticatorId,
    detach: async () => {
      await client.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId,
      });
      await client.send('WebAuthn.disable');
      await client.detach();
    },
  };
}
