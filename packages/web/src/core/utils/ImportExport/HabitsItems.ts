import { habitsItemsClient } from '@/core/api/modules/habits';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
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

interface RawHabitsItemPayload {
  title?: unknown;
  category?: unknown;
  frequency?: unknown;
  started_at?: unknown;
  archived?: unknown;
  target?: unknown;
  duration?: unknown;
}

interface NormalisedHabitsItemPayload {
  title: string;
  category: string;
  frequency: string;
  started_at: string;
  archived: boolean;
  target?: number;
  duration?: string;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('habits_items: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('habits_items: mainKey manquante.');
}

function normalizePayload(input: unknown): NormalisedHabitsItemPayload {
  const p = (input ?? {}) as RawHabitsItemPayload;
  const out: NormalisedHabitsItemPayload = {
    title: String(p.title ?? ''),
    category: typeof p.category === 'string' && p.category ? p.category : 'autre',
    frequency: typeof p.frequency === 'string' && p.frequency ? p.frequency : 'weekly',
    started_at: String(p.started_at ?? ''),
    archived: Boolean(p.archived),
  };
  if (p.target != null) out.target = Number(p.target);
  if (p.duration) out.duration = String(p.duration);
  return out;
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.title)}::${normalizeKeyPart(p.started_at)}`;
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
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current HabitsItemPayloadSchema (category is a free string
  // here, an enum there) ; cast until the rewire lands.
  const rec = await habitsItemsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as Parameters<typeof habitsItemsClient.create>[2],
  );
  return { action: 'created', id: rec.id };
}

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

const HabitsItemsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HabitsItemsImportExport;
