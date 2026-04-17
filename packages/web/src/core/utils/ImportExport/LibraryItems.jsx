import { libraryItemsClient } from "@/core/api/modules/library";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "library_items",
  version: 1,
  runtimeKey: "library-items",
  collection: "library_items_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) throw new Error("library_items: moduleUserId manquant.");
  if (!ctx.mainKey) throw new Error("library_items: mainKey manquante.");
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    type: p.type || "book",
    title: String(p.title || ""),
    creators: Array.isArray(p.creators) ? p.creators.map(String) : [],
    status: p.status || "planned",
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

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.type)}::${normalizeKeyPart(
    p.provider || ""
  )}::${normalizeKeyPart(p.external_id || p.title)}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  const rec = await libraryItemsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await libraryItemsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid || !mainKey) return new Set();
  const keys = new Set();
  const list = await libraryItemsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const LibraryItemsImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default LibraryItemsImportExport;
