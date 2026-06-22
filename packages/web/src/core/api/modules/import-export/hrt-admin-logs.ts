import {
  HrtAdminLogPayloadSchema,
  type HrtAdminLogPayload,
} from '@nodea/shared';
import { hrtAdminLogsClient } from '@/core/api/modules/hrt';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import { stripParentRefKey } from './relink.ts';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'hrt_admin_logs',
  version: 1,
  runtimeKey: 'hrt-admin-logs',
  collection: 'hrt_admin_logs_entries',
  // A materialised dose carries an OPTIONAL `scheduleId` (server id) for
  // its source recurring schedule. The dose's main join is `product` by
  // name (already portable); this remaps the provenance link, and clears
  // it on a cross-host restore if the schedule can't be resolved (#155).
  parentRef: { field: 'scheduleId', parentPlugin: 'hrt_schedules', optional: true },
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('hrt_admin_logs: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('hrt_admin_logs: mainKey manquante.');
}

function normalizePayload(input: unknown): HrtAdminLogPayload {
  const p = stripParentRefKey((input ?? {}) as Record<string, unknown>);
  return HrtAdminLogPayloadSchema.parse({
    ...p,
    date: String(p.date ?? ''),
    product: String(p.product ?? ''),
    dose: Number(p.dose ?? 0),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // One dose = a product taken at a date (+ optional time + amount). Two
  // doses of the same product, same day, same time, same amount are a
  // duplicate; a different time or dose is a distinct event.
  return [
    normalizeKeyPart(p.date.slice(0, 10)),
    normalizeKeyPart(p.time),
    normalizeKeyPart(p.product),
    normalizeKeyPart(String(p.dose)),
  ].join('::');
}

export async function importHandler({
  payload,
  ctx,
}: {
  payload: unknown;
  ctx: ImportExportPluginCtx;
}): Promise<{ action: 'created'; id: string }> {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  const rec = await hrtAdminLogsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  hrtAdminLogsClient,
  normalizePayload,
  'hrt_admin_logs',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await hrtAdminLogsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload: unknown): {
  module: string;
  version: number;
  payload: unknown;
} {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({
  sid,
  mainKey,
}: {
  sid: string;
  mainKey: ImportExportPluginCtx['mainKey'];
}): Promise<Set<string>> {
  if (!sid || !mainKey) return new Set();
  const keys = new Set<string>();
  const list = await hrtAdminLogsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HrtAdminLogsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HrtAdminLogsImportExport;
