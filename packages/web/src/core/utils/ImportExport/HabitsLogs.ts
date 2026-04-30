import { habitsLogsClient } from '@/core/api/modules/habits';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
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

interface RawHabitsLogPayload {
  date?: unknown;
  item_rid?: unknown;
  done?: unknown;
}

interface NormalisedHabitsLogPayload {
  date: string;
  item_rid: string;
  done: boolean;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('habits_logs: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('habits_logs: mainKey manquante.');
}

function normalizePayload(input: unknown): NormalisedHabitsLogPayload {
  const p = (input ?? {}) as RawHabitsLogPayload;
  return {
    date: String(p.date ?? ''),
    item_rid: String(p.item_rid ?? ''),
    done: Boolean(p.done ?? true),
  };
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(p.item_rid)}`;
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
  if (!clear.date || !clear.item_rid) {
    throw new Error('habits_logs: date et item_rid requis.');
  }
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current HabitsLogPayloadSchema (passthrough mode adds an
  // index signature) ; cast until the rewire lands.
  const rec = await habitsLogsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as Parameters<typeof habitsLogsClient.create>[2],
  );
  return { action: 'created', id: rec.id };
}

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
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HabitsLogsImportExport;
