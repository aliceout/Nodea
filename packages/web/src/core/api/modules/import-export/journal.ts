import {
  JournalPayloadSchema,
  type JournalPayload,
} from '@nodea/shared';
import { journalClient } from '@/core/api/modules/journal';
import { makeBulkImportHandler, normalizeKeyPart, contentFingerprint } from './utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'journal',
  version: 1,
  runtimeKey: 'journal',
  collection: 'journal_entries',
};

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx?.moduleUserId) throw new Error('journal: moduleUserId manquant.');
  if (!ctx.mainKey) throw new Error('journal: mainKey manquante.');
}

/**
 * Schema-driven normalisation. `content` is required (`min(1)`) and
 * `date` carries the entry day ; everything else (thread, title,
 * attachments) is filled by the schema's defaults so a slimmer legacy
 * shape still parses. Inline base64 image attachments ride along inside
 * the same payload — the backup carries them verbatim.
 */
function normalizePayload(input: unknown): JournalPayload {
  const p = (input ?? {}) as Record<string, unknown>;
  return JournalPayloadSchema.parse({
    ...p,
    date: String(p.date ?? ''),
    content: String(p.content ?? ''),
  });
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  // A day can hold several entries (different threads, several notes, or
  // two entries that differ only in title or past their shared opening).
  // The key folds in thread + title + a full-content fingerprint so two
  // imports of the SAME entry collapse, but no genuinely different entry
  // is ever dropped on restore.
  return [
    normalizeKeyPart(p.date.slice(0, 10)),
    normalizeKeyPart(p.thread),
    normalizeKeyPart(p.title ?? ''),
    contentFingerprint(p.content),
  ].join('::');
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
  const rec = await journalClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: 'created', id: rec.id };
}

export const bulkImportHandler = makeBulkImportHandler(
  journalClient,
  normalizePayload,
  'journal',
);

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await journalClient.list(ctx.moduleUserId, ctx.mainKey);
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
  const list = await journalClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const JournalImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  bulkImportHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default JournalImportExport;
