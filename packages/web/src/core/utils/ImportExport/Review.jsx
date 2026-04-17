import { reviewClient } from "@/core/api/modules/review";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "review",
  version: 1,
  runtimeKey: "review",
  collection: "review_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) throw new Error("review: moduleUserId manquant.");
  if (!ctx.mainKey) throw new Error("review: mainKey manquante.");
}

function normalizePayload(input) {
  const p = input || {};
  return {
    year: Number(p.year),
    last_year: p.last_year && typeof p.last_year === "object" ? p.last_year : {},
    next_year: p.next_year && typeof p.next_year === "object" ? p.next_year : {},
    closing: p.closing && typeof p.closing === "object" ? p.closing : {},
  };
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return normalizeKeyPart(String(p.year));
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  if (!Number.isFinite(clear.year)) {
    throw new Error("review: year doit être un nombre.");
  }
  const rec = await reviewClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await reviewClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid || !mainKey) return new Set();
  const keys = new Set();
  const list = await reviewClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const ReviewImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default ReviewImportExport;
