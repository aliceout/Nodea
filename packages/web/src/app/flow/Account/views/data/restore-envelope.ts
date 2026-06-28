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
 *
 * Relational remap (#155): some children reference a parent by SERVER id
 * (review→book, dose→schedule), which breaks on a new
 * account/host where parents get fresh ids. So the loop runs in two
 * phases — parents/standalone first, then children — and between them
 * builds, per referenced parent, a `naturalKey → currentServerId` index
 * (covering both pre-existing and just-imported parents). Each child's
 * reference is rewritten from the stable parent key the export stamped on
 * it (`stampParentKeys`). A child is never dropped: an unresolved required
 * ref stays an orphan (recoverable), an unresolved optional ref is cleared.
 */
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { getDataPlugin } from '@/core/api/modules/import-export/registry.data.ts';
import {
  idSet,
  indexByKey,
  relinkParentRefs,
} from '@/core/api/modules/import-export/relink.ts';
import type { ImportExportPlugin } from '@/core/api/modules/import-export/types.ts';

/** Minimal structural view of the Zustand modules slice this needs.
 *  `| undefined` on the field keeps the zod-derived store entry
 *  (`moduleUserId?: string | undefined`) assignable under
 *  `exactOptionalPropertyTypes`. */
type ModulesSlice =
  | Record<string, { moduleUserId?: string | null | undefined } | undefined>
  | null
  | undefined;

type Translate = (
  key: string,
  opts?: { values?: Record<string, string | number> },
) => string;

export interface RestoreResult {
  count: number;
  parts: string[];
  /** Module keys whose write failed mid-restore (network/auth blip): the
   *  restore is PARTIAL. Callers must treat a non-empty list as "not fully
   *  restored" (e.g. don't let an auto-backup overwrite the remote with an
   *  incomplete account). Distinct from the corrupted-file `failedModules`. */
  failed: string[];
  /** How many modules present in the backup were SKIPPED — not enabled on this
   *  account, or an unrecognised key. Distinct from `failed` (a write that
   *  errored). `count === 0` with `skippedModules > 0` means "nothing restored
   *  because the modules aren't here", which must NOT read as "already up to
   *  date" (a fresh device that hasn't enabled its modules yet). */
  skippedModules: number;
}

interface ResolvedModule {
  key: string;
  items: unknown[];
  plugin: ImportExportPlugin;
  sid: string;
}

export async function restoreEnvelope(
  modulesObj: Record<string, unknown[]>,
  mainKey: MainKeyMaterial,
  slice: ModulesSlice,
  t: Translate,
): Promise<RestoreResult> {
  const parts: string[] = [];
  const failed: string[] = [];
  let count = 0;
  let skippedModules = 0;

  async function pluginFor(moduleKey: string) {
    const plugin = await getDataPlugin(moduleKey);
    const runtimeKey = plugin.meta?.runtimeKey ?? plugin.meta?.id ?? moduleKey;
    if (!runtimeKey) return null;
    const sid = slice?.[runtimeKey]?.moduleUserId;
    if (!sid) return null;
    return { plugin, sid };
  }

  // Commit one module's items: dedup via natural key, then create the
  // survivors (bulk when the plugin supports it, else per-row). A module
  // that throws mid-restore must NOT abort the whole loop (audit 2026-06
  // passe 2): wrap it, record a partial-failure line, keep going.
  async function runModule(r: ResolvedModule, items: unknown[]): Promise<void> {
    const { key, plugin, sid } = r;
    try {
      const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });

      // Two passes : (1) filter via the natural-key dedup, (2) commit.
      // Splitting them lets the bulk path see the full deduped list and
      // collapse 2×N round-trips into 2 per chunk. The per-row fallback
      // still loops, identically to the pre-bulk code.
      const filtered: unknown[] = [];
      let skipped = 0;
      for (const payload of items) {
        const k = plugin.getNaturalKey?.(payload) ?? null;
        if (k && existing.has(k)) {
          skipped += 1;
          continue;
        }
        filtered.push(payload);
        if (k) existing.add(k);
      }

      let created = 0;
      if (plugin.bulkImportHandler && filtered.length > 0) {
        // Atomicity is per CollectionClient chunk (BULK_MAX_ENTRIES).
        // A throw aborts THIS module only ; chunks already committed
        // stay, the per-row idempotency makes a re-run safe.
        const res = await plugin.bulkImportHandler({
          payloads: filtered,
          ctx: { moduleUserId: sid, mainKey },
        });
        created = res.ids.length;
      } else {
        for (const payload of filtered) {
          await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
          created += 1;
        }
      }
      parts.push(
        t('account.data.import.moduleResult', { values: { key, created, skipped } }),
      );
      count += created;
    } catch (err) {
      if (import.meta.env.DEV)
        console.warn(`restore: module ${key} failed`, err);
      failed.push(key);
      parts.push(
        t('account.data.import.moduleFailed', { values: { key } }),
      );
    }
  }

  // Resolve every present module up-front so we can order parents before
  // children regardless of the envelope's key order, and emit the same
  // unknown/disabled skip lines as before.
  const resolved: ResolvedModule[] = [];
  for (const [key, items] of Object.entries(modulesObj)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    let r: Awaited<ReturnType<typeof pluginFor>>;
    try {
      r = await pluginFor(key);
    } catch {
      skippedModules += 1;
      parts.push(t('account.data.import.moduleSkippedUnknown', { values: { key } }));
      continue;
    }
    if (!r) {
      skippedModules += 1;
      parts.push(t('account.data.import.moduleSkippedDisabled', { values: { key } }));
      continue;
    }
    resolved.push({ key, items, plugin: r.plugin, sid: r.sid });
  }

  const children = resolved.filter((r) => r.plugin.meta.parentRef);
  const nonChildren = resolved.filter((r) => !r.plugin.meta.parentRef);

  // Phase 1 — parents + standalone modules.
  for (const r of nonChildren) await runModule(r, r.items);

  // Build, per parent a present child references, a `naturalKey →
  // currentServerId` map AND the set of live parent ids on this host.
  // Done after phase 1 so it captures both pre-existing parents AND the
  // ones just imported ; resolved against the target's own collection,
  // so it also links children to parents that already lived there
  // (re-importing only the children).
  interface ParentIndex {
    keyToId: Map<string, string>;
    liveIds: Set<string>;
  }
  const EMPTY_INDEX: ParentIndex = { keyToId: new Map(), liveIds: new Set() };
  const parentIndexes = new Map<string, ParentIndex>();
  for (const c of children) {
    const pid = c.plugin.meta.parentRef!.parentPlugin;
    if (parentIndexes.has(pid)) continue;
    try {
      const parentPlugin = await getDataPlugin(pid);
      const runtimeKey = parentPlugin.meta.runtimeKey ?? parentPlugin.meta.id;
      const parentSid = slice?.[runtimeKey]?.moduleUserId;
      if (!parentPlugin.listKeyIndex || !parentSid) {
        parentIndexes.set(pid, EMPTY_INDEX);
        continue;
      }
      const idx = await parentPlugin.listKeyIndex({ sid: parentSid, mainKey });
      parentIndexes.set(pid, { keyToId: indexByKey(idx), liveIds: idSet(idx) });
    } catch {
      // Parent unresolvable → empty index: required refs stay orphans,
      // optional refs clear. Never drops a child.
      parentIndexes.set(pid, EMPTY_INDEX);
    }
  }

  // Phase 2 — children, with their parent reference rewritten to the
  // parent's id on THIS host before the (id-aware) dedup + create. A ref
  // already pointing at a live parent is left untouched (same-host
  // idempotency, incl. under a parent natural-key collision).
  let orphaned = 0;
  for (const c of children) {
    const ref = c.plugin.meta.parentRef!;
    const idx = parentIndexes.get(ref.parentPlugin) ?? EMPTY_INDEX;
    const { remapped, unresolved } = relinkParentRefs(
      c.items,
      ref,
      idx.keyToId,
      idx.liveIds,
    );
    orphaned += unresolved;
    await runModule(c, remapped);
  }

  // Surface orphaned children (parent genuinely missing from the
  // backup) — mirrors the export's partial-failure warning so a
  // cross-host restore never silently leaves dangling links.
  if (orphaned > 0) {
    parts.push(
      t('account.data.import.orphanedRefs', { values: { count: orphaned } }),
    );
  }

  return { count, parts, failed, skippedModules };
}
