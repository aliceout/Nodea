/**
 * PKCE (RFC 7636) verifier + S256 challenge for OAuth2 public clients.
 *
 * WHAT  Generates a high-entropy `code_verifier` and its `code_challenge`
 *       (`base64url(SHA-256(verifier))`) — the proof-of-possession pair that
 *       lets a browser app finish an OAuth code exchange with NO client secret.
 * WHERE `core/cloud-backup`, beside the provider clients that consume it
 *       (Dropbox today; Google/OneDrive later reuse the exact same PKCE). Kept
 *       pure + DOM-free on purpose so it unit-tests without a `window` — the
 *       popup plumbing that genuinely needs the DOM lives in `dropbox-oauth.ts`.
 * NOTE  Reuses the central base64url + randomBytes helpers (the single source
 *       for both, per the crypto rules) — never a second encoder here.
 */
import { randomBytes, bytesToBase64Url } from '@/core/crypto/base64';
import { sha256 } from '@/core/crypto/hash';
import type { Base64Url } from '@nodea/shared/crypto-types';

/** `base64url(SHA-256(verifier))` — the S256 challenge for a given verifier. */
export async function deriveChallenge(verifier: Base64Url): Promise<Base64Url> {
  const digest = await sha256(new TextEncoder().encode(verifier));
  return bytesToBase64Url(digest);
}

/** A fresh verifier (32 random bytes → 43 base64url chars, RFC 7636 minimum)
 *  paired with its S256 challenge. */
export async function createPkcePair(): Promise<{
  verifier: Base64Url;
  challenge: Base64Url;
}> {
  const verifier = bytesToBase64Url(randomBytes(32));
  const challenge = await deriveChallenge(verifier);
  return { verifier, challenge };
}
