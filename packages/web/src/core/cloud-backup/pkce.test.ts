import { describe, it, expect } from 'vitest';

import type { Base64Url } from '@nodea/shared/crypto-types';
import { deriveChallenge, createPkcePair } from './pkce';

describe('pkce', () => {
  // RFC 7636 Appendix B — the canonical S256 vector. Pins our SHA-256 +
  // base64url composition to the spec, so a future encoder swap can't
  // silently produce a challenge no OAuth server accepts.
  it('derives the RFC 7636 challenge from its verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' as Base64Url;
    expect(await deriveChallenge(verifier)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('createPkcePair yields a verifier whose challenge round-trips', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(await deriveChallenge(verifier)).toBe(challenge);
  });
});
