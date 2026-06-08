/**
 * Apply a `{ modules }` envelope to the user's account — the shared restore
 * step behind BOTH the plaintext JSON import and the decrypted encrypted
 * backup. Extracted from `ImportPanel` so the two entry points (a clear
 * `.json` and a deciphered `.age`) run the exact same idempotent loop.
 *
 * Idempotency is per-record via each plugin's natural key: re-importing the
 * same data is a no-op, not a duplicator. Per-module failures are reported
 * as skips (unknown / disabled) rather than aborting the whole restore.
 * Returns structured counts + ready-to-show `parts` lines (formatted here
 * with the caller's `t` so the UI stays declarative).
 */
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { getDataPlugin } from '@/core/api/modules/import-export/registry.data.ts';

/** Minimal structural view of the Zustand modules slice this needs. */
type ModulesSlice =
  | Record<string, { moduleUserId?: string | null } | undefined>
  | null
  | undefined;

type Translate = (
  key: string,
  opts?: { values?: Record<string, string | number> },
) => string;

export interface RestoreResult {
  count: number;
  parts: string[];
}

export async function restoreEnvelope(
  modulesObj: Record<string, unknown[]>,
  mainKey: MainKeyMaterial,
  slice: ModulesSlice,
  t: Translate,
): Promise<RestoreResult> {
  const parts: string[] = [];
  let count = 0;

  async function pluginFor(moduleKey: string) {
    const plugin = await getDataPlugin(moduleKey);
    const runtimeKey = plugin.meta?.runtimeKey ?? plugin.meta?.id ?? moduleKey;
    if (!runtimeKey) return null;
    const sid = slice?.[runtimeKey]?.moduleUserId;
    if (!sid) return null;
    return { plugin, sid };
  }

  for (const [key, items] of Object.entries(modulesObj)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    let resolved: Awaited<ReturnType<typeof pluginFor>>;
    try {
      resolved = await pluginFor(key);
    } catch {
      parts.push(t('account.data.import.moduleSkippedUnknown', { values: { key } }));
      continue;
    }
    if (!resolved) {
      parts.push(t('account.data.import.moduleSkippedDisabled', { values: { key } }));
      continue;
    }
    const { plugin, sid } = resolved;
    const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });
    let created = 0;
    let skipped = 0;
    for (const payload of items) {
      const k = plugin.getNaturalKey?.(payload) ?? null;
      if (k && existing.has(k)) {
        skipped += 1;
        continue;
      }
      await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
      if (k) existing.add(k);
      created += 1;
    }
    parts.push(
      t('account.data.import.moduleResult', { values: { key, created, skipped } }),
    );
    count += created;
  }

  return { count, parts };
}
