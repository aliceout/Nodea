import {
  HrtLabResultPayloadSchema,
  type HrtLabResultPayload,
} from '@nodea/shared';
import { hrtLabResultsClient } from '@/core/api/modules/hrt';
import { normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'hrt_lab_results',
  version: 1,
  runtimeKey: 'hrt-lab-results',
  collection: 'hrt_lab_results_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('hrt_lab_results: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('hrt_lab_results: mainKey manquante.');
}

function normalizePayload(input: unknown): HrtLabResultPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return HrtLabResultPayloadSchema.parse({
    ...p,
    date: String(p.date ?? ''),
    marker: String(p.marker ?? ''),
    value: Number(p.value ?? 0),
    unit: String(p.unit ?? ''),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // A reading = one marker value on a date, for a draw context. The value
  // is part of the key so a same-day re-measure (peak vs trough already
  // split by `context`) doesn't collapse onto an earlier reading.
  return [
    normalizeKeyPart(p.date.slice(0, 10)),
    normalizeKeyPart(p.marker),
    normalizeKeyPart(p.context),
    normalizeKeyPart(String(p.value)),
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
  const rec = await hrtLabResultsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await hrtLabResultsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await hrtLabResultsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HrtLabResultsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HrtLabResultsImportExport;
