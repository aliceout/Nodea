import type { SessionUser } from '../../store/nodea-store.ts';
import type { MainKeyMaterial } from '../../crypto/key-material.ts';

/* ----------------------------------------------------------------
 * Inputs / results — surfaced verbatim by `useSession()` and used
 * by the auth pages (Login, Register, Recover, Settings).
 * -------------------------------------------------------------- */

export interface SessionRegisterInput {
  email: string;
  /** Public display name — required since the username field landed
   *  in Phase 1. Validated server-side against `UsernameField` (2-32
   *  chars, alphanumerics + `_-.`). */
  username: string;
  password: string;
  /** Invite-token branch: pre-filled by Register from the URL when
   *  the user arrived via an invite link. Optional — when omitted the
   *  call hits the open-registration path instead (which 403s if the
   *  admin toggle is off). */
  inviteToken?: string;
}

export interface SessionRegisterResult {
  /** True when the server activated the account at submit time
   *  (invited path). False when the user must still click an
   *  activation email (open path). */
  activated: boolean;
  /** Echoed back from the server on the invited path so the UI can
   *  redirect to /login?activated=1 with the email known. */
  email?: string;
}

export interface SessionChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SessionRecoveryCodeResult {
  /** 12-word BIP39 mnemonic — display ONCE to the user, never
   *  persisted client-side. The caller is expected to show it +
   *  collect an "I've noted it" acknowledgement before navigating
   *  away. */
  mnemonic: string;
  /** True when this call replaced an existing recovery code. False
   *  for first-time setup. Drives the post-flow message
   *  ("nouveau" vs "remplacé"). */
  regenerated: boolean;
}

export interface SessionRecoverInput {
  email: string;
  /** 12 BIP39 words typed by the user. Whitespace is normalised
   *  upstream — empty / wrong-length / bad-checksum surfaces as
   *  the typed `Error('invalid_recovery_code')`. */
  mnemonic: string;
  newPassword: string;
}

/* ----------------------------------------------------------------
 * Deps — store mutations + current user. Each action helper takes a
 * narrow subset (declared in its own module) so the type errors stay
 * local when a helper grows a new dependency.
 * -------------------------------------------------------------- */

export type SetAuth = (user: SessionUser | null) => void;
export type SetMainKey = (material: MainKeyMaterial | null) => void;
export type MarkKeyMissing = () => void;
export type ResetAll = () => void;
