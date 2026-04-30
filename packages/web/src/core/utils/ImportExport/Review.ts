import {
  ReviewPayloadSchema,
  type ReviewPayload,
} from '@nodea/shared';
import { reviewClient } from '@/core/api/modules/review';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'review',
  version: 1,
  runtimeKey: 'review',
  collection: 'review_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('review: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('review: mainKey manquante.');
}

/**
 * Schema-driven normalisation. The legacy export shape is mostly
 * compatible with `ReviewPayloadSchema` ; we just coerce `year` to
 * a number (was sometimes a string in old exports) and let Zod fill
 * `updated_at` from its `.default('')`.
 */
function normalizePayload(input: unknown): ReviewPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return ReviewPayloadSchema.parse({
    ...p,
    year: Number(p.year),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return normalizeKeyPart(String(p.year));
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
  if (!Number.isFinite(clear.year)) {
    throw new Error('review: year doit être un nombre.');
  }
  const rec = await reviewClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await reviewClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await reviewClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const ReviewImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default ReviewImportExport;
