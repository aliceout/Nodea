import { habitsItemsClient } from "@/core/api/modules/habits";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "habits_items",
  version: 1,
  runtimeKey: "habits-items",
  collection: "habits_items_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) throw new Error("habits_items: moduleUserId manquant.");
  if (!ctx.mainKey) throw new Error("habits_items: mainKey manquante.");
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    title: String(p.title || ""),
    category: p.category || "autre",
    frequency: p.frequency || "weekly",
    started_at: String(p.started_at || ""),
    archived: Boolean(p.archived),
  };
  if (p.target != null) out.target = Number(p.target);
  if (p.duration) out.duration = String(p.duration);
  return out;
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.title)}::${normalizeKeyPart(p.started_at)}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  const rec = await habitsItemsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await habitsItemsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid || !mainKey) return new Set();
  const keys = new Set();
  const list = await habitsItemsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HabitsItemsImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HabitsItemsImportExport;
