import { habitsLogsClient } from "@/core/api/modules/habits";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "habits_logs",
  version: 1,
  runtimeKey: "habits-logs",
  collection: "habits_logs_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) throw new Error("habits_logs: moduleUserId manquant.");
  if (!ctx.mainKey) throw new Error("habits_logs: mainKey manquante.");
}

function normalizePayload(input) {
  const p = input || {};
  return {
    date: String(p.date || ""),
    item_rid: String(p.item_rid || ""),
    done: Boolean(p.done ?? true),
  };
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(p.item_rid)}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  if (!clear.date || !clear.item_rid) {
    throw new Error("habits_logs: date et item_rid requis.");
  }
  const rec = await habitsLogsClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await habitsLogsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) yield normalizePayload(rec.payload);
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid || !mainKey) return new Set();
  const keys = new Set();
  const list = await habitsLogsClient.list(sid, mainKey);
  for (const rec of list) {
    const k = getNaturalKey(rec.payload);
    if (k) keys.add(k);
  }
  return keys;
}

const HabitsLogsImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default HabitsLogsImportExport;
