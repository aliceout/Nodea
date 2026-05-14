/**
 * Barrel re-export for the passkey orchestrators.
 *
 * The flow used to live in a single `core/auth/passkey-flow.ts`
 * (530 LOC). Split in REFACTO-07 into three files (`enroll.ts`,
 * `login.ts`, `shared.ts`) ; this barrel keeps a single import
 * point so consumers don't have to know which sub-file holds
 * which export.
 */
export { enrollPasskey } from './enroll.ts';
export type {
  EnrollPasskeyInput,
  EnrollPasskeyResult,
} from './enroll.ts';

export { loginWithPasskey } from './login.ts';
export type {
  PasskeyLoginInput,
  PasskeyLoginRawResult,
} from './login.ts';
