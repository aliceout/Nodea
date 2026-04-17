import { moodClient } from "@/core/api/modules/mood";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = { id: "mood", version: 1, collection: "mood_entries" };

function ensureContext(ctx) {
  if (!ctx) throw new Error("ctx manquant");
  if (!ctx.moduleUserId) throw new Error("moduleUserId manquant dans ctx");
  if (!ctx.mainKey) throw new Error("mainKey manquante dans ctx");
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    date: String(p.date || ""),
    mood_score: p.mood_score ?? "",
    mood_emoji: p.mood_emoji ?? "",
    positive1: p.positive1 ?? "",
    positive2: p.positive2 ?? "",
    positive3: p.positive3 ?? "",
  };
  if (p.comment) out.comment = String(p.comment);
  if (p.question) out.question = String(p.question);
  if (p.answer) out.answer = String(p.answer);
  return out;
}

export function getNaturalKey(payload) {
  if (!payload?.date) return null;
  const d = String(payload.date).slice(0, 10);
  return normalizeKeyPart(d);
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid) throw new Error("listExistingKeys: sid manquant");
  if (!mainKey) throw new Error("listExistingKeys: mainKey manquante");

  const keys = new Set();
  const list = await moodClient.list(sid, mainKey);
  for (const rec of list) {
    const key = getNaturalKey(rec.payload);
    if (key) keys.add(key);
  }
  return keys;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  const rec = await moodClient.create(ctx.moduleUserId, ctx.mainKey, clear);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx, range } = {}) {
  ensureContext(ctx);
  const list = await moodClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    const obj = rec.payload;
    if (range?.start || range?.end) {
      const d = obj?.date ? new Date(obj.date) : null;
      if (range?.start && (!d || d < new Date(range.start))) continue;
      if (range?.end && (!d || d > new Date(range.end))) continue;
    }
    yield obj;
  }
}

export function exportSerialize(plainPayload) {
  return {
    module: meta.id,
    version: meta.version,
    payload: plainPayload,
  };
}

const MoodImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default MoodImportExport;
