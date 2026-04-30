import { libraryReviewsClient } from '@/core/api/modules/library';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'library_reviews',
  version: 1,
  runtimeKey: 'library-reviews',
  collection: 'library_reviews_entries',
};

interface RawLibraryReviewPayload {
  date?: unknown;
  item_rid?: unknown;
  note?: unknown;
  page?: unknown;
  snippet?: unknown;
}

interface NormalisedLibraryReviewPayload {
  date: string;
  item_rid: string;
  note: string;
  page?: number;
  snippet?: string;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('library_reviews: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('library_reviews: mainKey manquante.');
}

function normalizePayload(input: unknown): NormalisedLibraryReviewPayload {
  const p = (input ?? {}) as RawLibraryReviewPayload;
  const out: NormalisedLibraryReviewPayload = {
    date: String(p.date ?? ''),
    item_rid: String(p.item_rid ?? ''),
    note: String(p.note ?? ''),
  };
  if (p.page != null) out.page = Number(p.page);
  if (p.snippet) out.snippet = String(p.snippet);
  return out;
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.item_rid,
  )}::${normalizeKeyPart(p.note.slice(0, 40))}`;
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
  if (!clear.date || !clear.item_rid || !clear.note) {
    throw new Error('library_reviews: date, item_rid et note requis.');
  }
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current LibraryReviewPayloadSchema (which uses content/kind
  // instead of note ; spoiler/title are required) ; cast until
  // the rewire lands.
  const rec = await libraryReviewsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as unknown as Parameters<typeof libraryReviewsClient.create>[2],
  );
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await libraryReviewsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await libraryReviewsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const LibraryReviewsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default LibraryReviewsImportExport;
