import { zxcvbnOptions, zxcvbn } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommonPackage.dictionary,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
});

const MIN_LENGTH = 12;
const MIN_SCORE = 3;

export interface PolicyResult {
  ok: boolean;
  reason?: string;
  score: number;
}

export function checkPasswordPolicy(password: string, userInputs: string[] = []): PolicyResult {
  if (password.length < MIN_LENGTH) {
    return { ok: false, reason: `password must be at least ${MIN_LENGTH} characters`, score: 0 };
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
