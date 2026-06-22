import {
  HABIT_CATEGORY_VALUES,
  HABIT_FREQUENCY_VALUES,
  HabitsItemPayloadSchema,
  type HabitsItemPayload,
} from '@nodea/shared';
import { habitsItemsClient } from '@/core/api/modules/habits';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'habits_items',
  version: 1,
  runtimeKey: 'habits-items',
  collection: 'habits_items_entries',
};

const HABIT_CATEGORY_SET: ReadonlySet<string> = new Set(HABIT_CATEGORY_VALUES);
const HABIT_FREQUENCY_SET: ReadonlySet<string> = new Set(HABIT_FREQUENCY_VALUES);

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('habits_items: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('habits_items: mainKey manquante.');
}

/**
 * Schema-driven normalisation. `category` and `frequency` are enum
 * fields in `HabitsItemPayloadSchema` ; coerce unknown values back
 * to their canonical default (`autre` / `weekly`) so legacy export
 * files with free-form values still parse.
 */
function normalizePayload(input: unknown): HabitsItemPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  const category =
    typeof p.category === 'string' && HABIT_CATEGORY_SET.has(p.category)
      ? p.category
      : 'autre';
  const frequency =
    typeof p.frequency === 'string' && HABIT_FREQUENCY_SET.has(p.frequency)
      ? p.frequency
      : 'weekly';
  return HabitsItemPayloadSchema.parse({
    ...p,
    title: String(p.title ?? ''),
    startedAt: String(p.startedAt ?? p.started_at ?? ''),
    category,
    frequency,
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.title)}::${normalizeKeyPart(p.startedAt)}`;
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
  const rec = await habitsItemsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  habitsItemsClient,
  normalizePayload,
  'habits_items',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await habitsItemsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await habitsItemsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

/** Natural-key → server-id index for the relational remap (#155):
 *  habits logs resolve their `itemRid` against this. */
export async function listKeyIndex({
  sid,
  mainKey,
}: {
  sid: string;
  mainKey: ImportExportPluginCtx['mainKey'];
}): Promise<Array<{ id: string; key: string }>> {
  if (!sid || !mainKey) return [];
  const out: Array<{ id: string; key: string }> = [];
  const list = await habitsItemsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) out.push({ id: rec.id, key: k });
  }
  return out;
}

const HabitsItemsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
  listKeyIndex,
};

export default HabitsItemsImportExport;
