import {
  HabitsLogPayloadSchema,
  type HabitsLogPayload,
} from '@nodea/shared';
import { habitsLogsClient } from '@/core/api/modules/habits';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'habits_logs',
  version: 1,
  runtimeKey: 'habits-logs',
  collection: 'habits_logs_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('habits_logs: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('habits_logs: mainKey manquante.');
}

function normalizePayload(input: unknown): HabitsLogPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return HabitsLogPayloadSchema.parse({
    ...p,
    date: String(p.date ?? ''),
    itemRid: String(p.itemRid ?? p.item_rid ?? ''),
  });
}

/** `normalizePayload` + a second pass that rejects entries the schema
 *  accepts but the domain doesn't : empty `date` / `itemRid` would let
 *  an orphan log through. Shared between the per-row and bulk paths so
 *  the rule stays in one place. */
function normalizeForCreate(input: unknown): HabitsLogPayload {
  const clear = normalizePayload(input);
  if (!clear.date || !clear.itemRid) {
    throw new Error('habits_logs: date et itemRid requis.');
  }
  return clear;
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(p.itemRid)}`;
}

export async function importHandler({
  payload,
  ctx,
}: {
  payload: unknown;
  ctx: ImportExportPluginCtx;
}): Promise<{ action: 'created'; id: string }> {
  ensureContext(ctx);
  const clear = normalizeForCreate(payload);
  const rec = await habitsLogsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  habitsLogsClient,
  normalizeForCreate,
  'habits_logs',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await habitsLogsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await habitsLogsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HabitsLogsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HabitsLogsImportExport;
