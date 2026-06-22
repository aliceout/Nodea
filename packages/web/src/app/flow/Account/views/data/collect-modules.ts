/**
 * Walk every registered module and pull its decrypted entries — the single
 * gather step shared by the plaintext export (`/export`) and the encrypted
 * backup (`/backup`), both launched from the Données tab's export menu.
 *
 * Runs entirely client-side: each plugin's `exportQuery` decrypts with the
 * in-memory main key, so nothing round-trips the server in clear. A single
 * module failing is non-fatal — a backup of the modules that *did* answer
 * beats no backup at all — but the failed modules are returned in `failed`
 * so the caller can WARN the user (audit 2026-06 passe 2 : they were only
 * DEV-console-logged, so a prod user got « ✓ Export réussi » on a backup
 * silently missing a module — the worst surprise at restore time). Also
 * forwarded through `onModuleError` for logging.
 */
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import {
  getDataPlugin,
  knownModules,
} from '@/core/api/modules/import-export/registry.data.ts';
import {
  indexById,
  stampParentKeys,
} from '@/core/api/modules/import-export/relink.ts';

/** Minimal structural view of the Zustand modules slice this needs.
 *  `| undefined` on the field keeps the zod-derived store entry
 *  (`moduleUserId?: string | undefined`) assignable under
 *  `exactOptionalPropertyTypes`. */
type ModulesSlice =
  | Record<string, { moduleUserId?: string | null | undefined } | undefined>
  | null
  | undefined;

export interface CollectModulesResult {
  /** Decrypted entries per module key (only modules that answered). */
  out: Record<string, unknown[]>;
  /** Keys of enabled modules whose collection threw mid-export. Empty
   *  on a clean run. The caller MUST surface this to the user. */
  failed: string[];
}

export async function collectModules(
  mainKey: MainKeyMaterial,
  modules: ModulesSlice,
  onModuleError?: (moduleKey: string, err: unknown) => void,
): Promise<CollectModulesResult> {
  const out: Record<string, unknown[]> = {};
  const failed: string[] = [];
  for (const moduleKey of knownModules()) {
    try {
      const plugin = await getDataPlugin(moduleKey);
      const runtimeKey = plugin.meta?.runtimeKey ?? moduleKey;
      const sid = modules?.[runtimeKey]?.moduleUserId;
      if (!sid) continue; // module disabled — not a failure, nothing to back up
      const items: unknown[] = [];
      for await (const payload of plugin.exportQuery({
        ctx: { moduleUserId: sid, mainKey },
        pageSize: 200,
      })) {
        items.push(payload);
      }
      if (items.length) out[moduleKey] = items;
    } catch (err) {
      failed.push(moduleKey);
      onModuleError?.(moduleKey, err);
    }
  }

  // Relational pass (#155): stamp each child record with its parent's
  // stable content key, so a cross-host import can remap the server-id
  // reference (review→book, log→habit, dose→schedule). Runs after the
  // gather so every parent collection is available; a failure here is
  // non-fatal — the export still restores same-host, exactly as before.
  for (const childKey of Object.keys(out)) {
    const children = out[childKey];
    if (!children) continue;
    try {
      const childPlugin = await getDataPlugin(childKey);
      const ref = childPlugin.meta.parentRef;
      if (!ref) continue;
      const parentPlugin = await getDataPlugin(ref.parentPlugin);
      if (!parentPlugin.listKeyIndex) continue;
      const parentRuntimeKey =
        parentPlugin.meta.runtimeKey ?? parentPlugin.meta.id;
      const parentSid = modules?.[parentRuntimeKey]?.moduleUserId;
      if (!parentSid) continue;
      const index = await parentPlugin.listKeyIndex({
        sid: parentSid,
        mainKey,
      });
      out[childKey] = stampParentKeys(children, ref, indexById(index));
    } catch (err) {
      // Non-fatal: an un-stamped child just falls back to same-host
      // behaviour on restore (the pre-#155 status quo).
      onModuleError?.(childKey, err);
    }
  }

  return { out, failed };
}
