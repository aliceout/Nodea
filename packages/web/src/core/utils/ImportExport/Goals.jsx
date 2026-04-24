import { goalsClient } from "@/core/api/modules/goals";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = { id: "goals", version: 1, collection: "goals_entries" };

function ensureContext(ctx) {
  if (!ctx) throw new Error("ctx manquant");
  if (!ctx.moduleUserId) throw new Error("moduleUserId manquant dans ctx");
  if (!ctx.mainKey) throw new Error("mainKey manquante dans ctx");
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    date: String(p.date || ""),
    title: String(p.title || ""),
    status: ["active", "done", "archived", "open", "wip"].includes(p.status)
      ? p.status
      : "active",
    thread: String(p.thread || ""),
  };
  if (p.note != null) out.note = String(p.note);
  return out;
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.thread
  )}::${normalizeKeyPart(p.title)}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  const rec = await goalsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await goalsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    yield normalizePayload(rec.payload);
  }
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid) throw new Error("listExistingKeys: sid manquant");
  if (!mainKey) throw new Error("listExistingKeys: mainKey manquante");

  const keys = new Set();
  const list = await goalsClient.list(sid, mainKey);
  for (const rec of list) {
    const key = getNaturalKey(rec.payload);
    if (key) keys.add(key);
  }
  return keys;
}

const GoalsImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default GoalsImportExport;
