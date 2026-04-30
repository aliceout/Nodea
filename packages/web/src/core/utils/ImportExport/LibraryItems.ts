import {
  LIBRARY_FORMAT_VALUES,
  LIBRARY_STATUS_VALUES,
  LibraryItemPayloadSchema,
  type LibraryItemPayload,
} from '@nodea/shared';
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

const STATUS_SET: ReadonlySet<string> = new Set(LIBRARY_STATUS_VALUES);
const FORMAT_SET: ReadonlySet<string> = new Set(LIBRARY_FORMAT_VALUES);

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('library_items: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('library_items: mainKey manquante.');
}

/**
 * Schema-driven normalisation. Legacy export shape used a flat
 * `provider` + `external_id` pair ; the canonical schema groups
 * these into a `providers` object. We migrate on the fly so old
 * export files still round-trip — the plugin `meta.version` stays
 * `1` because the normalised output matches the current schema
 * exactly.
 */
function normalizePayload(input: unknown): LibraryItemPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  const status =
    typeof p.status === 'string' && STATUS_SET.has(p.status)
      ? p.status
      : 'planned';
  const format =
    typeof p.format === 'string' && FORMAT_SET.has(p.format)
      ? p.format
      : 'unknown';

  // Legacy migration : flat provider/external_id → grouped `providers`.
  let providers = p.providers as Record<string, unknown> | undefined;
  if (!providers && (p.provider || p.external_id)) {
    providers = {};
    if (typeof p.provider === 'string' && typeof p.external_id === 'string') {
      providers[p.provider] = p.external_id;
    }
  }

  return LibraryItemPayloadSchema.parse({
    ...p,
    title: String(p.title ?? ''),
    status,
    format,
    ...(providers ? { providers } : {}),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // Use `providers` (canonical) if present, otherwise fall back to
  // the title alone — keeps imports of provider-less manual entries
  // dedup-able by title.
  const providerEntries = Object.entries(p.providers ?? {});
  const providerKey = providerEntries.length
    ? `${providerEntries[0]?.[0]}:${String(providerEntries[0]?.[1])}`
    : '';
  return `${normalizeKeyPart(p.type)}::${normalizeKeyPart(
    providerKey,
  )}::${normalizeKeyPart(providerKey ? '' : p.title)}`;
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
  const rec = await libraryItemsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
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
