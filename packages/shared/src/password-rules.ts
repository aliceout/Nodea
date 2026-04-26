/**
 * Shared password rule set — checked client-side for instant UX
 * feedback (live tick list under the input, blocks submit until
 * green), and re-checked server-side in `checkPasswordPolicy` so
 * a bypassed client can't slip a weak password through.
 *
 * Ruleset is deliberately strict per Issue/spec: 12+ characters,
 * lowercase, uppercase, digit, special. zxcvbn score is enforced
 * separately on the server (defence-in-depth against rules-met-but-
 * still-guessable strings like `Password1!Password1!`).
 */

export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRulesCheck {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  special: boolean;
}

export function checkPasswordRules(password: string): PasswordRulesCheck {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    // Anything that isn't a letter, digit or whitespace counts as
    // "special" — same shape as common policy validators (OWASP
    // recommendation #3 & #4) without the false-positive trap of
    // hand-listing a punctuation set.
    special: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function passwordRulesPassed(check: PasswordRulesCheck): boolean {
  return (
    check.length &&
    check.lowercase &&
    check.uppercase &&
    check.digit &&
    check.special
  );
}
