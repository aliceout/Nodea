import {
  LIBRARY_REVIEW_KIND_VALUES,
  LibraryReviewPayloadSchema,
  type LibraryReviewPayload,
} from '@nodea/shared';
import { libraryReviewsClient } from '@/core/api/modules/library';
import { makeBulkImportHandler, normalizeKeyPart, contentFingerprint } from './utils';
import { stripParentRefKey } from './relink.ts';
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
  // A review references its parent book by server id; remap it on a
  // cross-host restore (issue #155).
  parentRef: { field: 'itemRid', parentPlugin: 'library_items' },
};

const KIND_SET: ReadonlySet<string> = new Set(LIBRARY_REVIEW_KIND_VALUES);

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('library_reviews: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('library_reviews: mainKey manquante.');
}

/**
 * Legacy export files used a single `note` field for the review
 * body, while the canonical `LibraryReviewPayloadSchema` splits it
 * into `content` (the body) + `kind` (`quote` for an extract,
 * `note` for free-form). When importing an older file we map
 * `legacy.note` → `content` and pick `kind = 'note'` (the safer
 * default) ; the page number, when present, gets carried through.
 */
function normalizePayload(input: unknown): LibraryReviewPayload {
  const p = stripParentRefKey((input ?? {}) as Record<string, unknown>);
  const content =
    typeof p.content === 'string' && p.content
      ? p.content
      : typeof p.note === 'string'
        ? p.note
        : '';
  const kind =
    typeof p.kind === 'string' && KIND_SET.has(p.kind) ? p.kind : 'note';
  return LibraryReviewPayloadSchema.parse({
    ...p,
    itemRid: String(p.itemRid ?? p.item_rid ?? ''),
    date: String(p.date ?? ''),
    content,
    kind,
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // Several reviews can share a day + book: two quotes from different
  // pages, a quote + a note, two notes. Fold in kind + page + a full
  // -content fingerprint (not a 40-char prefix, which collapsed quotes
  // sharing an opening and dropped the second on restore).
  return [
    normalizeKeyPart(p.date),
    normalizeKeyPart(p.itemRid),
    normalizeKeyPart(p.kind),
    normalizeKeyPart(String(p.page ?? '')),
    contentFingerprint(p.content),
  ].join('::');
}

/** `normalizePayload` + a second pass that rejects payloads the schema
 *  accepts but the domain doesn't (empty date/itemRid/content would
 *  let an orphan review through). Shared with the bulk path so the
 *  rule lives in one spot. */
function normalizeForCreate(input: unknown): LibraryReviewPayload {
  const clear = normalizePayload(input);
  if (!clear.date || !clear.itemRid || !clear.content) {
    throw new Error('library_reviews: date, itemRid et content requis.');
  }
  return clear;
}

export async function importHandler({
  payload,
  ctx,
}: {
  payload: unknown;
  ctx: ImportExportPluginCtx;
}): Promise<{ action: 'created'; id: string }> {
  ensureContext(ctx);
  const clear = normalizeForCreate(payload);
  const rec = await libraryReviewsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear,
  );
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  libraryReviewsClient,
  normalizeForCreate,
  'library_reviews',
);

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
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default LibraryReviewsImportExport;
