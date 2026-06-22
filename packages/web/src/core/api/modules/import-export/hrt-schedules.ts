import {
  HrtSchedulePayloadSchema,
  type HrtSchedulePayload,
} from '@nodea/shared';
import { hrtSchedulesClient } from '@/core/api/modules/hrt';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'hrt_schedules',
  version: 1,
  runtimeKey: 'hrt-schedules',
  collection: 'hrt_schedules_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('hrt_schedules: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('hrt_schedules: mainKey manquante.');
}

function normalizePayload(input: unknown): HrtSchedulePayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return HrtSchedulePayloadSchema.parse({
    ...p,
    product: String(p.product ?? ''),
    dose: Number(p.dose ?? 0),
    startDate: String(p.startDate ?? ''),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // A recurring series is identified by its product + first occurrence +
  // cadence — re-importing the same backup won't spawn a second series.
  return [
    normalizeKeyPart(p.product),
    normalizeKeyPart(p.startDate.slice(0, 10)),
    normalizeKeyPart(p.frequency),
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
  const rec = await hrtSchedulesClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  hrtSchedulesClient,
  normalizePayload,
  'hrt_schedules',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await hrtSchedulesClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await hrtSchedulesClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

/** Natural-key → server-id index for the relational remap (#155):
 *  HRT admin logs resolve their optional `scheduleId` against this. */
export async function listKeyIndex({
  sid,
  mainKey,
}: {
  sid: string;
  mainKey: ImportExportPluginCtx['mainKey'];
}): Promise<Array<{ id: string; key: string }>> {
  if (!sid || !mainKey) return [];
  const out: Array<{ id: string; key: string }> = [];
  const list = await hrtSchedulesClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) out.push({ id: rec.id, key: k });
  }
  return out;
}

const HrtSchedulesImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
  listKeyIndex,
};

export default HrtSchedulesImportExport;
