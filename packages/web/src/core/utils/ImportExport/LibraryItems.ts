import { libraryItemsClient } from '@/core/api/modules/library';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'library_items',
  version: 1,
  runtimeKey: 'library-items',
  collection: 'library_items_entries',
};

interface RawLibraryItemPayload {
  type?: unknown;
  title?: unknown;
  creators?: unknown;
  status?: unknown;
  tags?: unknown;
  provider?: unknown;
  external_id?: unknown;
  year?: unknown;
  language?: unknown;
  cover_url?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  rating?: unknown;
}

interface NormalisedLibraryItemPayload {
  type: string;
  title: string;
  creators: string[];
  status: string;
  tags: string[];
  provider?: string;
  external_id?: string;
  year?: number;
  language?: string;
  cover_url?: string;
  started_at?: string;
  finished_at?: string;
  rating?: number;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('library_items: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('library_items: mainKey manquante.');
}

function normalizePayload(input: unknown): NormalisedLibraryItemPayload {
  const p = (input ?? {}) as RawLibraryItemPayload;
  const out: NormalisedLibraryItemPayload = {
    type: typeof p.type === 'string' && p.type ? p.type : 'book',
    title: String(p.title ?? ''),
    creators: Array.isArray(p.creators) ? p.creators.map(String) : [],
    status: typeof p.status === 'string' && p.status ? p.status : 'planned',
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
  };
  if (p.provider) out.provider = String(p.provider);
  if (p.external_id) out.external_id = String(p.external_id);
  if (p.year != null) out.year = Number(p.year);
  if (p.language) out.language = String(p.language);
  if (p.cover_url) out.cover_url = String(p.cover_url);
  if (p.started_at) out.started_at = String(p.started_at);
  if (p.finished_at) out.finished_at = String(p.finished_at);
  if (p.rating != null) out.rating = Number(p.rating);
  return out;
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.type)}::${normalizeKeyPart(
    p.provider ?? '',
  )}::${normalizeKeyPart(p.external_id ?? p.title)}`;
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
  // current LibraryItemPayloadSchema (missing cover_rid, format,
  // is_favorite ; type/status are now enum-restricted) ; cast
  // until the rewire lands.
  const rec = await libraryItemsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as unknown as Parameters<typeof libraryItemsClient.create>[2],
  );
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await libraryItemsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await libraryItemsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const LibraryItemsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default LibraryItemsImportExport;
