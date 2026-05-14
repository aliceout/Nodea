/**
 * Unit tests for the pure MFA policy helpers (DB-free).
 *
 * Issue #72 introduced an OR set in the `always_2fa` password-first
 * row of the matrix. These tests pin the shape of the requirement
 * structure, the flatten/filter helpers used at the wire boundary,
 * and the satisfaction logic of `missingFactors` across the AND/OR
 * combinations the route layer relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  filterRequirementsByEnrollment,
  flattenRequirements,
  isFactorMandatory,
  missingFactors,
  requiredFactorsForMode,
  type FactorRequirement,
  type MfaFactor,
} from '../auth/mfa-policy.ts';

type Mode = 'password_or_passkey' | 'always_2fa' | 'maximum';

function asUser(securityMode: Mode) {
  return { securityMode };
}

const ALL_FALSE = {
  mfaPasswordVerified: false,
  mfaPasskeyVerified: false,
  mfaTotpVerified: false,
} as const;

describe('requiredFactorsForMode', () => {
  it('returns [] for password_or_passkey, both entries', () => {
    expect(requiredFactorsForMode(asUser('password_or_passkey'), 'password')).toEqual([]);
    expect(requiredFactorsForMode(asUser('password_or_passkey'), 'passkey')).toEqual([]);
  });

  it('returns an OR set for always_2fa password-first (TOTP or passkey)', () => {
    const reqs = requiredFactorsForMode(asUser('always_2fa'), 'password');
    expect(reqs).toHaveLength(1);
    const first = reqs[0]!;
    expect(typeof first).toBe('object');
    expect((first as { anyOf: readonly MfaFactor[] }).anyOf).toEqual(['totp', 'passkey']);
  });

  it('returns [totp] for always_2fa passkey-first (no second-passkey concept)', () => {
    expect(requiredFactorsForMode(asUser('always_2fa'), 'passkey')).toEqual(['totp']);
  });

  it('returns [passkey, totp] for maximum password-first', () => {
    expect(requiredFactorsForMode(asUser('maximum'), 'password')).toEqual([
      'passkey',
      'totp',
    ]);
  });

  it('returns [password, totp] for maximum passkey-first', () => {
    expect(requiredFactorsForMode(asUser('maximum'), 'passkey')).toEqual([
      'password',
      'totp',
    ]);
  });
});

describe('isFactorMandatory', () => {
  it('true when factor appears as a mandatory single requirement', () => {
    expect(isFactorMandatory(['totp', 'passkey'], 'totp')).toBe(true);
    expect(isFactorMandatory(['totp'], 'totp')).toBe(true);
  });

  it('false when factor appears only inside an OR set', () => {
    const reqs: readonly FactorRequirement[] = [{ anyOf: ['totp', 'passkey'] }];
    expect(isFactorMandatory(reqs, 'totp')).toBe(false);
    expect(isFactorMandatory(reqs, 'passkey')).toBe(false);
  });

  it('false when factor is absent', () => {
    expect(isFactorMandatory(['totp'], 'passkey')).toBe(false);
  });
});

describe('flattenRequirements', () => {
  it('preserves single factors and expands OR sets', () => {
    const reqs: readonly FactorRequirement[] = [
      'password',
      { anyOf: ['totp', 'passkey'] },
    ];
    expect(flattenRequirements(reqs)).toEqual(['password', 'totp', 'passkey']);
  });

  it('dedupes factors that appear multiple times', () => {
    const reqs: readonly FactorRequirement[] = [
      'totp',
      { anyOf: ['totp', 'passkey'] },
    ];
    expect(flattenRequirements(reqs)).toEqual(['totp', 'passkey']);
  });

  it('returns [] for empty requirements', () => {
    expect(flattenRequirements([])).toEqual([]);
  });
});

describe('filterRequirementsByEnrollment', () => {
  const orReq: FactorRequirement = { anyOf: ['totp', 'passkey'] };

  it('collapses OR to mandatory when only one alternative is enrolled', () => {
    const filtered = filterRequirementsByEnrollment([orReq], {
      totp: true,
      passkey: false,
      password: true,
    });
    expect(filtered).toEqual(['totp']);
  });

  it('keeps the OR shape when several alternatives are enrolled', () => {
    const filtered = filterRequirementsByEnrollment([orReq], {
      totp: true,
      passkey: true,
      password: true,
    });
    expect(filtered).toHaveLength(1);
    const first = filtered[0]!;
    expect((first as { anyOf: readonly MfaFactor[] }).anyOf).toEqual([
      'totp',
      'passkey',
    ]);
  });

  it('keeps the full OR set when no alternative is enrolled (paranoid fallback)', () => {
    const filtered = filterRequirementsByEnrollment([orReq], {
      totp: false,
      passkey: false,
      password: true,
    });
    expect(filtered).toHaveLength(1);
    const first = filtered[0]!;
    expect((first as { anyOf: readonly MfaFactor[] }).anyOf).toEqual([
      'totp',
      'passkey',
    ]);
  });

  it('passes single mandatory factors through untouched', () => {
    const filtered = filterRequirementsByEnrollment(['totp', 'passkey'], {
      totp: true,
      passkey: false,
      password: true,
    });
    expect(filtered).toEqual(['totp', 'passkey']);
  });
});

describe('missingFactors — password_or_passkey', () => {
  it('returns [] regardless of which entry factor was used', () => {
    expect(
      missingFactors(asUser('password_or_passkey'), {
        ...ALL_FALSE,
        mfaPasswordVerified: true,
      }),
    ).toEqual([]);
    expect(
      missingFactors(asUser('password_or_passkey'), {
        ...ALL_FALSE,
        mfaPasskeyVerified: true,
      }),
    ).toEqual([]);
  });
});

describe('missingFactors — always_2fa (OR set, password-first)', () => {
  it('lists every alternative when none is verified yet', () => {
    const missing = missingFactors(asUser('always_2fa'), {
      ...ALL_FALSE,
      mfaPasswordVerified: true,
    });
    expect(missing).toEqual(['totp', 'passkey']);
  });

  it('returns [] once TOTP is verified (OR satisfied)', () => {
    const missing = missingFactors(asUser('always_2fa'), {
      ...ALL_FALSE,
      mfaPasswordVerified: true,
      mfaTotpVerified: true,
    });
    expect(missing).toEqual([]);
  });

  it('returns [] once a passkey assertion is verified (OR satisfied)', () => {
    const missing = missingFactors(asUser('always_2fa'), {
      ...ALL_FALSE,
      mfaPasswordVerified: true,
      mfaPasskeyVerified: true,
    });
    expect(missing).toEqual([]);
  });
});

describe('missingFactors — always_2fa (passkey-first, TOTP-only)', () => {
  it('demands TOTP when entry is a passkey', () => {
    const missing = missingFactors(asUser('always_2fa'), {
      ...ALL_FALSE,
      mfaPasskeyVerified: true,
    });
    expect(missing).toEqual(['totp']);
  });

  it('returns [] once TOTP is verified on top of passkey-first', () => {
    const missing = missingFactors(asUser('always_2fa'), {
      ...ALL_FALSE,
      mfaPasskeyVerified: true,
      mfaTotpVerified: true,
    });
    expect(missing).toEqual([]);
  });
});

describe('missingFactors — maximum (AND, both entry paths)', () => {
  it('password-first → needs passkey + TOTP', () => {
    const missing = missingFactors(asUser('maximum'), {
      ...ALL_FALSE,
      mfaPasswordVerified: true,
    });
    expect(missing).toEqual(['passkey', 'totp']);
  });

  it('passkey-first → needs password + TOTP', () => {
    const missing = missingFactors(asUser('maximum'), {
      ...ALL_FALSE,
      mfaPasskeyVerified: true,
    });
    expect(missing).toEqual(['password', 'totp']);
  });

  it('returns [] once every required factor is verified', () => {
    const missing = missingFactors(asUser('maximum'), {
      mfaPasswordVerified: true,
      mfaPasskeyVerified: true,
      mfaTotpVerified: true,
    });
    expect(missing).toEqual([]);
  });
});

describe('missingFactors — corrupted "no entry factor" state', () => {
  it('surfaces everything for maximum so the client restarts', () => {
    const missing = missingFactors(asUser('maximum'), ALL_FALSE);
    expect([...missing]).toEqual(['password', 'passkey', 'totp']);
  });

  it('surfaces the always_2fa fallback set', () => {
    const missing = missingFactors(asUser('always_2fa'), ALL_FALSE);
    expect([...missing]).toEqual(['password', 'totp', 'passkey']);
  });

  it('surfaces [password] for the default mode', () => {
    expect([...missingFactors(asUser('password_or_passkey'), ALL_FALSE)]).toEqual([
      'password',
    ]);
  });
});
