import { CyclePayloadSchema, type CyclePayload } from '@nodea/shared';
import { cycleClient } from '@/core/api/modules/cycle';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'cycle',
  version: 1,
  collection: 'cycle_entries',
};

function ensureContext(
  ctx: ImportExportPluginCtx | undefined,
): asserts ctx is ImportExportPluginCtx {
  if (!ctx) throw new Error('cycle: ctx manquant');
  if (!ctx.moduleUserId) throw new Error('cycle: moduleUserId manquant dans ctx');
  if (!ctx.mainKey) throw new Error('cycle: mainKey manquante dans ctx');
}

/** The schema fills defaults for `symptoms` / `notes`, so a legacy or
 *  partial export still parses. Only `date` needs coercion. */
function normalizePayload(input: unknown): CyclePayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return CyclePayloadSchema.parse({ ...p, date: String(p.date ?? '') });
}

export function getNaturalKey(payload: unknown): string | null {
  const date = (payload as { date?: unknown } | null | undefined)?.date;
  if (!date) return null;
  return normalizeKeyPart(String(date).slice(0, 10));
}

export async function listExistingKeys({
  sid,
  mainKey,
}: {
  sid: string;
  mainKey: ImportExportPluginCtx['mainKey'];
}): Promise<Set<string>> {
  if (!sid) throw new Error('cycle: listExistingKeys — sid manquant');
  if (!mainKey) throw new Error('cycle: listExistingKeys — mainKey manquante');

  const keys = new Set<string>();
  const list = await cycleClient.list(sid, mainKey);
  for (const rec of list) {
    const key = getNaturalKey(rec.payload);
    if (key) keys.add(key);
  }
  return keys;
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
  const rec = await cycleClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  cycleClient,
  normalizePayload,
  'cycle',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await cycleClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    yield rec.payload;
  }
}

export function exportSerialize(plainPayload: unknown): {
  module: string;
  version: number;
  payload: unknown;
} {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

const CycleImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default CycleImportExport;
