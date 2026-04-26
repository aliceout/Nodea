import { zxcvbnOptions, zxcvbn } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommonPackage.dictionary,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
});

const MIN_SCORE = 3;

export interface PolicyResult {
  ok: boolean;
  reason?: string;
  score: number;
}

/**
 * Server-side password policy gate. Combines the static rule check
 * (length + character classes) shared with the client and the zxcvbn
 * strength estimate (defence-in-depth so e.g. `Password1!Password1!`
 * still gets rejected even though it passes every static rule).
 *
 * `userInputs` lets callers pass per-user context (email, username)
 * that zxcvbn should treat as low-entropy seed material.
 */
export function checkPasswordPolicy(password: string, userInputs: string[] = []): PolicyResult {
  const rules = checkPasswordRules(password);
  if (!rules.length) {
    return {
      ok: false,
      reason: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      score: 0,
    };
  }
  if (!passwordRulesPassed(rules)) {
    const missing: string[] = [];
    if (!rules.lowercase) missing.push('lowercase');
    if (!rules.uppercase) missing.push('uppercase');
    if (!rules.digit) missing.push('digit');
    if (!rules.special) missing.push('special character');
    return {
      ok: false,
      reason: `password must include ${missing.join(', ')}`,
      score: 0,
    };
  }
  const result = zxcvbn(password, userInputs);
  if (result.score < MIN_SCORE) {
    return {
      ok: false,
      reason: result.feedback.warning || 'password is too weak',
      score: result.score,
    };
  }
  return { ok: true, score: result.score };
}
