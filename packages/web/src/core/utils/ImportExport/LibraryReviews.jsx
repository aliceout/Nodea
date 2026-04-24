import { libraryReviewsClient } from "@/core/api/modules/library";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "library_reviews",
  version: 1,
  runtimeKey: "library-reviews",
  collection: "library_reviews_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) throw new Error("library_reviews: moduleUserId manquant.");
  if (!ctx.mainKey) throw new Error("library_reviews: mainKey manquante.");
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    date: String(p.date || ""),
    item_rid: String(p.item_rid || ""),
    note: String(p.note || ""),
  };
  if (p.page != null) out.page = Number(p.page);
  if (p.snippet) out.snippet = String(p.snippet);
  return out;
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.item_rid
  )}::${normalizeKeyPart(p.note.slice(0, 40))}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  if (!clear.date || !clear.item_rid || !clear.note) {
    throw new Error("library_reviews: date, item_rid et note requis.");
  }
  const rec = await libraryReviewsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await libraryReviewsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid || !mainKey) return new Set();
  const keys = new Set();
  const list = await libraryReviewsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const LibraryReviewsImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default LibraryReviewsImportExport;
