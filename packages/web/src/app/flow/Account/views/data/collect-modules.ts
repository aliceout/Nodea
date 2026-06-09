/**
 * Walk every registered module and pull its decrypted entries — the single
 * gather step shared by the plaintext export (`ExportPanel`) and the
 * encrypted backup (`BackupExportPanel`).
 *
 * Runs entirely client-side: each plugin's `exportQuery` decrypts with the
 * in-memory main key, so nothing round-trips the server in clear. A single
 * module failing is non-fatal — a backup of the modules that *did* answer
 * beats no backup at all — and the failure is surfaced through
 * `onModuleError` for the caller to log (never swallowed silently).
 */
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import {
  getDataPlugin,
  knownModules,
} from '@/core/api/modules/import-export/registry.data.ts';

/** Minimal structural view of the Zustand modules slice this needs.
 *  `| undefined` on the field keeps the zod-derived store entry
 *  (`moduleUserId?: string | undefined`) assignable under
 *  `exactOptionalPropertyTypes`. */
type ModulesSlice =
  | Record<string, { moduleUserId?: string | null | undefined } | undefined>
  | null
  | undefined;

export async function collectModules(
  mainKey: MainKeyMaterial,
  modules: ModulesSlice,
  onModuleError?: (moduleKey: string, err: unknown) => void,
): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const moduleKey of knownModules()) {
    try {
      const plugin = await getDataPlugin(moduleKey);
      const runtimeKey = plugin.meta?.runtimeKey ?? moduleKey;
      const sid = modules?.[runtimeKey]?.moduleUserId;
      if (!sid) continue;
      const items: unknown[] = [];
      for await (const payload of plugin.exportQuery({
        ctx: { moduleUserId: sid, mainKey },
        pageSize: 200,
      })) {
        items.push(payload);
      }
      if (items.length) out[moduleKey] = items;
    } catch (err) {
      onModuleError?.(moduleKey, err);
    }
  }
  return out;
}
