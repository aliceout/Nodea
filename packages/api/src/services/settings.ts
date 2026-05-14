import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { appSettings } from '../db/schema.ts';

/**
 * App-wide settings — thin wrapper over the `app_settings` key/value
 * table. V1 stores only `open_registration` ('true' | 'false'); future
 * settings (TOTP requirement, banner text, etc.) land here without a
 * schema change.
 *
 * Reads return the default when the row is absent — there is no
 * bootstrap step, the table starts empty. This keeps the seed scripts
 * + test setup minimal.
 */

export type SettingKey = 'open_registration';

const DEFAULTS: Record<SettingKey, string> = {
  open_registration: 'false',
};

export async function getSettingRaw(key: SettingKey): Promise<string> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? DEFAULTS[key];
}

export async function setSettingRaw(
  key: SettingKey,
  value: string,
  updatedBy: string | null,
): Promise<void> {
  // Upsert via Postgres ON CONFLICT DO UPDATE — Drizzle's
  // `.onConflictDoUpdate` keeps both code paths in a single statement.
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: updatedBy ?? null, updatedAt: new Date() },
    });
}

/* ---- typed helpers per setting (boolean, etc.) ----------------- */

export async function isOpenRegistration(): Promise<boolean> {
  const raw = await getSettingRaw('open_registration');
  return raw === 'true';
}

export async function setOpenRegistration(
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  await setSettingRaw('open_registration', enabled ? 'true' : 'false', updatedBy);
}
