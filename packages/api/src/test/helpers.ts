import { randomUUID } from 'node:crypto';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { hashPassword } from '../auth/password.ts';
import { createInvite } from '../auth/invites.ts';

export const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-42';
export const ADMIN_PASSWORD = 'Admin-Horse-Battery-Staple-42';

export async function seedAdmin(email = 'admin@example.com'): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await db.insert(users).values({
    id,
    email: email.toLowerCase(),
    passwordHash,
    encryptionSalt: 'test-salt',
    encryptedKey: 'test-wrapped-key',
    role: 'admin',
    // Bypass the new activation gate (Auth-Roadmap Phase 1 reworked).
    // Tests that explicitly want an inactive user can null this back
    // out via a follow-up UPDATE.
    emailVerifiedAt: new Date(),
  });
  return { id, email };
}

export async function seedUser(email: string): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await db.insert(users).values({
    id,
    email: email.toLowerCase(),
    passwordHash,
    encryptionSalt: 'test-salt',
    encryptedKey: 'test-wrapped-key',
    emailVerifiedAt: new Date(),
  });
  return { id, email };
}

export async function seedInvite(): Promise<{ id: string; code: string }> {
  return createInvite();
}

/** Extract the session cookie from a Set-Cookie header, for chaining requests. */
export function extractCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_session=([^;]+)/);
  return match ? `nodea_session=${match[1]}` : null;
}
