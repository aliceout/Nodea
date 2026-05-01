import {
  GoalsPayloadSchema,
  type GoalsPayload,
} from '@nodea/shared';
import { goalsClient } from '@/core/api/modules/goals';
import { normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'goals',
  version: 1,
  collection: 'goals_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx) throw new Error('goals: ctx manquant');
  if (!ctx.moduleUserId) throw new Error('goals: moduleUserId manquant dans ctx');
  if (!ctx.mainKey) throw new Error('goals: mainKey manquante dans ctx');
}

/**
 * Schema-driven normalisation. The legacy export shape mostly
 * matches `GoalsPayloadSchema` already ; we just coerce `title`
 * into a string (it's the only required-non-default field) and
 * let Zod fill the rest from its `.default(...)` clauses, including
 * the legacy `active` / `archived` aliases that the schema's
 * status enum still accepts.
 */
function normalizePayload(input: unknown): GoalsPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return GoalsPayloadSchema.parse({
    ...p,
    title: String(p.title ?? ''),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.thread,
  )}::${normalizeKeyPart(p.title)}`;
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
  const rec = await goalsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await goalsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    yield normalizePayload(rec.payload);
  }
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
  if (!sid) throw new Error('goals: listExistingKeys — sid manquant');
  if (!mainKey) throw new Error('goals: listExistingKeys — mainKey manquante');

  const keys = new Set<string>();
  const list = await goalsClient.list(sid, mainKey);
  for (const rec of list) {
    const key = getNaturalKey(rec.payload);
    if (key) keys.add(key);
  }
  return keys;
}

const GoalsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default GoalsImportExport;
