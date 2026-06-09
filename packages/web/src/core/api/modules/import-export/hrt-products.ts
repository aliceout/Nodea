import {
  HrtProductPayloadSchema,
  type HrtProductPayload,
} from '@nodea/shared';
import { hrtProductsClient } from '@/core/api/modules/hrt';
import { makeBulkImportHandler, normalizeKeyPart } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

// Wire collection stays `hrt-suppliers` (migration 0018) — the domain
// concept is « product ». `runtimeKey` matches the modules-slice key, the
// envelope `id` uses the domain name.
export const meta: ImportExportPluginMeta = {
  id: 'hrt_products',
  version: 1,
  runtimeKey: 'hrt-suppliers',
  collection: 'hrt_suppliers_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('hrt_products: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('hrt_products: mainKey manquante.');
}

function normalizePayload(input: unknown): HrtProductPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return HrtProductPayloadSchema.parse({
    ...p,
    name: String(p.name ?? ''),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // `name` is the catalog's unique join key (admin logs + schedules
  // reference a product by name) — so it is the natural dedup key.
  return normalizeKeyPart(p.name);
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
  const rec = await hrtProductsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  hrtProductsClient,
  normalizePayload,
  'hrt_products',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await hrtProductsClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await hrtProductsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HrtProductsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HrtProductsImportExport;
