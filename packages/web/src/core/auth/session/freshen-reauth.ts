import { freshenPasswordReauth } from '../opaque.ts';

/**
 * Phase 7B: bump `sessions.reauth_password_at = now()` so the next
 * mutating Settings call passes the `requireFreshPassword`
 * middleware. Wraps {@link freshenPasswordReauth} from
 * `core/auth/opaque.ts` — the helper-of-helpers exists here so the
 * mutating actions in this folder all read with one
 * `await freshenReauth(currentPassword)` line, which is the same
 * shape they had with the old `issuePasswordProof` minus the
 * proof-token plumbing.
 */
export async function freshenReauth(password: string): Promise<void> {
  await freshenPasswordReauth(password);
}
