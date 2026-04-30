import { moodClient } from '@/core/api/modules/mood';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
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

interface RawMoodPayload {
  date?: unknown;
  mood_score?: unknown;
  mood_emoji?: unknown;
  positive1?: unknown;
  positive2?: unknown;
  positive3?: unknown;
  comment?: unknown;
  question?: unknown;
  answer?: unknown;
}

interface NormalisedMoodPayload {
  date: string;
  mood_score: unknown;
  mood_emoji: unknown;
  positive1: unknown;
  positive2: unknown;
  positive3: unknown;
  comment?: string;
  question?: string;
  answer?: string;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx) throw new Error('mood: ctx manquant');
  if (!ctx.moduleUserId) throw new Error('mood: moduleUserId manquant dans ctx');
  if (!ctx.mainKey) throw new Error('mood: mainKey manquante dans ctx');
}

function normalizePayload(input: unknown): NormalisedMoodPayload {
  const p = (input ?? {}) as RawMoodPayload;
  const out: NormalisedMoodPayload = {
    date: String(p.date ?? ''),
    mood_score: p.mood_score ?? '',
    mood_emoji: p.mood_emoji ?? '',
    positive1: p.positive1 ?? '',
    positive2: p.positive2 ?? '',
    positive3: p.positive3 ?? '',
  };
  if (p.comment) out.comment = String(p.comment);
  if (p.question) out.question = String(p.question);
  if (p.answer) out.answer = String(p.answer);
  return out;
}

export function getNaturalKey(payload: unknown): string | null {
  const p = payload as RawMoodPayload | null | undefined;
  if (!p?.date) return null;
  const d = String(p.date).slice(0, 10);
  return normalizeKeyPart(d);
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
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current Zod schemas (e.g. mood_score is typed `unknown` here
  // but `string` in MoodPayloadSchema) ; the cast keeps the
  // legacy import/export flow runnable until the rewire lands.
  const rec = await moodClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as Parameters<typeof moodClient.create>[2],
  );
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
