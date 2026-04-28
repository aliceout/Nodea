import { generate as otplibGenerate } from 'otplib';

/**
 * Generate a current TOTP code for the given base32 secret. Uses
 * the same options as the api side (`auth/totp.ts` — SHA-1 / 6
 * digits / 30 s period), so a code generated here is what the api
 * accepts at `/auth/mfa/totp/verify` or `/auth/totp/enroll/verify`.
 *
 * The secret comes from the api's enroll-start response — the test
 * scrapes it from the page (it's displayed for manual entry) and
 * feeds it back through this helper to produce a valid 6-digit
 * code.
 */
export async function totpCode(secretBase32: string): Promise<string> {
  return otplibGenerate({
    strategy: 'totp',
    secret: secretBase32,
    digits: 6,
    period: 30,
    algorithm: 'sha1',
  });
}
