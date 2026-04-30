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

interface RawReviewPayload {
  year?: unknown;
  last_year?: unknown;
  next_year?: unknown;
  closing?: unknown;
}

interface NormalisedReviewPayload {
  year: number;
  last_year: Record<string, unknown>;
  next_year: Record<string, unknown>;
  closing: Record<string, unknown>;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('review: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('review: mainKey manquante.');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizePayload(input: unknown): NormalisedReviewPayload {
  const p = (input ?? {}) as RawReviewPayload;
  return {
    year: Number(p.year),
    last_year: isPlainObject(p.last_year) ? p.last_year : {},
    next_year: isPlainObject(p.next_year) ? p.next_year : {},
    closing: isPlainObject(p.closing) ? p.closing : {},
  };
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
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current ReviewPayloadSchema (missing required updated_at) ;
  // cast until the rewire lands.
  const rec = await reviewClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as Parameters<typeof reviewClient.create>[2],
  );
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
