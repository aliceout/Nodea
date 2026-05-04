import postgres from 'postgres';

/**
 * Direct DB access for the e2e suite. Used to:
 *   - Read state the API doesn't expose (e.g. confirm
 *     `mfa_bypass_requests` advances states correctly).
 *   - Time-shift confirmed bypass requests past the 7-day window
 *     without waiting an actual week (`backdateBypassConfirmation`).
 *   - Truncate between tests when explicit reset is desired.
 *
 * One connection is shared across the whole run — the test count
 * is small and serial.
 */

const E2E_DB_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgres://nodea:Wise-Sinless6-Untainted-Unwed-Onward@127.0.0.1:5433/nodea_e2e';

let _sql: ReturnType<typeof postgres> | null = null;

export function db(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(E2E_DB_URL, { max: 1, prepare: false });
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}

/** Backdate the `confirmed_at` of every active bypass request for
 *  a user, so the next login picks up the bypass at apply time. */
export async function backdateBypassConfirmation(userId: string): Promise<void> {
  const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await db()`
    UPDATE mfa_bypass_requests
    SET confirmed_at = ${past}
    WHERE user_id = ${userId}
      AND confirmed_at IS NOT NULL
      AND consumed_at IS NULL
      AND cancelled_at IS NULL
  `;
}

/** Read the security_mode of a user — used to assert downgrades. */
export async function getSecurityMode(userId: string): Promise<string | null> {
  const rows = await db()`
    SELECT security_mode FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.['security_mode'] as string | null;
}

/** Read whether TOTP is enabled — used to assert post-bypass state. */
export async function isTotpEnabled(userId: string): Promise<boolean> {
  const rows = await db()`
    SELECT enabled_at FROM mfa_totp WHERE user_id = ${userId} LIMIT 1
  `;
  if (rows.length === 0) return false;
  return rows[0]?.['enabled_at'] !== null;
}

/** Read user id by email — goes through the api test-only endpoint
 *  rather than a direct DB query so the dev `pnpm dev:api` (which
 *  Playwright reuses via `reuseExistingServer: true`) and the test
 *  helper see the same rows even when DATABASE_URL points at a
 *  different db than E2E_DATABASE_URL. */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
  const res = await fetch(
    `${apiUrl}/__test__/user-id?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { id: string | null };
  return json.id;
}

/** Promote a user to admin role. Goes through the api test-only
 *  endpoint for the same reason as `getUserIdByEmail`. */
export async function promoteToAdmin(userId: string): Promise<void> {
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
  await fetch(`${apiUrl}/__test__/promote-admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}
