/**
 * Canary tests for the auth schema's behaviour-coupled error messages.
 *
 * `UsernameField` emits the literal string `'invalid_username'` on
 * `ZodIssue.message` for any regex mismatch — RegisterForm reads that
 * string as an error CODE to dispatch French copy. Any future Zod
 * upgrade or refactor that wraps, localises, or prefixes the message
 * would silently degrade the registration UX to a generic error.
 *
 * These tests pin the literal emission so the regression surfaces
 * immediately rather than at a user-reported bug.
 */
import { describe, expect, it } from 'vitest';

import { UsernameField } from './auth.ts';

describe('UsernameField', () => {
  it('accepts a valid Unicode username', () => {
    expect(UsernameField.safeParse('élise_42').success).toBe(true);
  });

  it('emits ZodIssue.message === "invalid_username" on a regex mismatch', () => {
    // RegisterForm reads errors.username?.message as an error code —
    // the literal must survive any Zod upgrade.
    const result = UsernameField.safeParse('!!!invalid!!!');
    expect(result.success).toBe(false);
    if (result.success) return;
    const regexIssue = result.error.issues.find(
      (issue) => 'format' in issue && issue.format === 'regex',
    );
    expect(regexIssue?.message).toBe('invalid_username');
  });

  it('rejects too-short and too-long usernames', () => {
    expect(UsernameField.safeParse('a').success).toBe(false);
    expect(UsernameField.safeParse('x'.repeat(33)).success).toBe(false);
  });
});
