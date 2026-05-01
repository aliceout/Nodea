import {
  MoodPayloadSchema,
  type MoodPayload,
} from '@nodea/shared';
import { moodClient } from '@/core/api/modules/mood';
import { normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'mood',
  version: 1,
  collection: 'mood_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx) throw new Error('mood: ctx manquant');
  if (!ctx.moduleUserId) throw new Error('mood: moduleUserId manquant dans ctx');
  if (!ctx.mainKey) throw new Error('mood: mainKey manquante dans ctx');
}

/**
 * Coerce + validate against the canonical schema. The schema fills
 * defaults for `mood_emoji` / `positive1-3` / `comment`, so a legacy
 * export missing those fields still parses cleanly. `mood_score` is
 * coerced to string (the schema requires `z.string()` ; old exports
 * sometimes shipped a number).
 */
function normalizePayload(input: unknown): MoodPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return MoodPayloadSchema.parse({
    ...p,
    date: String(p.date ?? ''),
    mood_score: String(p.mood_score ?? ''),
  });
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
  if (!sid) throw new Error('mood: listExistingKeys — sid manquant');
  if (!mainKey) throw new Error('mood: listExistingKeys — mainKey manquante');

  const keys = new Set<string>();
  const list = await moodClient.list(sid, mainKey);
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
  const rec = await moodClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await moodClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    yield rec.payload;
  }
}

export function exportSerialize(plainPayload: unknown): {
  module: string;
  version: number;
  payload: unknown;
} {
  return {
    module: meta.id,
    version: meta.version,
    payload: plainPayload,
  };
}

const MoodImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default MoodImportExport;
