import {
  createPassageEntry,
  decryptPassageRecord,
} from "@/core/api/modules/Passage";
import { listRecords } from "@/core/api/pb-records";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
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
  if (!hasMainKeyMaterial(ctx.mainKey)) {
    throw new Error("Passage.import: mainKey manquante.");
  }
}

function normalizePayload(input) {
  const p = input || {};
  return {
    date: String(p.date || ""),
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
  const { moduleUserId, mainKey, log } = ctx;
  const p = normalizePayload(payload);

  if (!p.thread || !p.content) {
    throw new Error(
      "Passage.import: payload invalide (thread et content requis)."
    );
  }

  const sealedPayload = {
    type: "passage.entry",
    date: p.date || new Date().toISOString(),
    thread: p.thread,
    title: p.title || null,
    content: p.content,
  };

  if (typeof log === "function") {
    log(`Passage.import -> create (${p.date} / ${p.thread})`);
  }

  await createPassageEntry(moduleUserId, mainKey, sealedPayload);
}

export async function* exportQuery({ ctx }) {
  ensureContext(ctx);
  const { moduleUserId, mainKey } = ctx;
  const perPage = ctx?.pageSize || 200;

  let page = 1;
  while (true) {
    const data = await listRecords(meta.collection, {
      sid: moduleUserId,
      page,
      perPage,
      sort: "-created",
    });
    const items = data?.items || [];
    if (!items.length) break;

    for (const rec of items) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey);
        const p = normalizePayload(dec?.payload || {});
        if (p.thread && p.content) {
          yield {
            date: p.date,
            thread: p.thread,
            title: p.title,
            content: p.content,
          };
        }
      } catch {
        // ignore entries that cannot be decrypted
      }
    }

    if (!data.items || data.items.length < perPage) break;
    page += 1;
  }
}

export function exportSerialize(plainPayload) {
  return {
    module: meta.id,
    version: meta.version,
    payload: plainPayload,
  };
}

export async function listExistingKeys(args = {}) {
  const ctx = args.ctx || {};
  const moduleUserId = args.sid || ctx.moduleUserId;
  const mainKey = args.mainKey || ctx.mainKey;

  const keys = new Set();
  if (!moduleUserId || !hasMainKeyMaterial(mainKey)) return keys;

  let page = 1;
  const perPage = 200;

  while (true) {
    const data = await listRecords(meta.collection, {
      sid: moduleUserId,
      page,
      perPage,
      sort: "-created",
    });
    const items = data?.items || [];
    if (!items.length) break;

    for (const rec of items) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey);
        const p = normalizePayload(dec?.payload || {});
        if (p.date && p.thread) {
          keys.add(getNaturalKey(p));
        }
      } catch {
        // ignore
      }
    }

    if (!data.items || data.items.length < perPage) break;
    page += 1;
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
