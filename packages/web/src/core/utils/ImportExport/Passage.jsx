import { passageClient } from "@/core/api/modules/passage";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";

export const meta = {
  id: "passage",
  version: 1,
  collection: "passage_entries",
};

function ensureContext(ctx) {
  if (!ctx?.moduleUserId) {
    throw new Error("Passage.import: moduleUserId manquant.");
  }
  if (!ctx.mainKey) {
    throw new Error("Passage.import: mainKey manquante.");
  }
}

function normalizePayload(input) {
  const p = input || {};
  return {
    type: "passage.entry",
    date: String(p.date || new Date().toISOString()),
    thread: String(p.thread || ""),
    title: p.title ? String(p.title) : null,
    content: String(p.content || ""),
  };
}

export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(p.thread)}`;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const p = normalizePayload(payload);
  if (!p.thread || !p.content) {
    throw new Error(
      "Passage.import: payload invalide (thread et content requis)."
    );
  }
  const rec = await passageClient.create(ctx.moduleUserId, ctx.mainKey, p);
  return { action: "created", id: rec.id };
}

export async function* exportQuery({ ctx } = {}) {
  ensureContext(ctx);
  const list = await passageClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    const p = normalizePayload(rec.payload);
    if (p.thread && p.content) {
      yield {
        date: p.date,
        thread: p.thread,
        title: p.title,
        content: p.content,
      };
    }
  }
}

export function exportSerialize(plainPayload) {
  return {
    module: meta.id,
    version: meta.version,
    payload: plainPayload,
  };
}

export async function listExistingKeys({ sid, mainKey }) {
  if (!sid) throw new Error("listExistingKeys: sid manquant");
  if (!mainKey) throw new Error("listExistingKeys: mainKey manquante");

  const keys = new Set();
  const list = await passageClient.list(sid, mainKey);
  for (const rec of list) {
    const p = normalizePayload(rec.payload);
    if (p.date && p.thread) {
      keys.add(getNaturalKey(p));
    }
  }
  return keys;
}

const PassageImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default PassageImportExport;
