import pb from "@/core/api/pocketbase";
import { encryptAESGCM, decryptAESGCM } from "@/core/crypto/webcrypto";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";
import { createEncryptedRecord, listRecords } from "@/core/api/pb-records";

export const meta = { id: "mood", version: 1, collection: "mood_entries" };

function ensureContext(ctx) {
  if (!ctx) throw new Error("ctx manquant");
  if (!ctx.moduleUserId) throw new Error("moduleUserId manquant dans ctx");
  if (!hasMainKeyMaterial(ctx.mainKey)) {
    throw new Error("mainKey manquante ou invalide dans ctx");
  }
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

export async function listExistingKeys({ pb: pbClient, sid, mainKey }) {
  if (!sid) throw new Error("listExistingKeys: sid manquant");
  if (!hasMainKeyMaterial(mainKey)) {
    throw new Error("listExistingKeys: mainKey manquante");
  }

  const client = pbClient || pb;
  const keys = new Set();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const data = await listRecords(meta.collection, {
      sid,
      page,
      perPage,
      sort: "-created",
      fields: "id,payload,cipher_iv",
    });
    const items = data?.items || [];
    if (!items.length) break;

    for (const it of items) {
      try {
        const clear = await decryptAESGCM(
          { iv: it.cipher_iv, data: it.payload },
          mainKey
        );
        const payload = JSON.parse(clear || "{}");
        const key = getNaturalKey(payload);
        if (key) keys.add(key);
      } catch {
        // ignore
      }
    }

    if (page * perPage >= (data?.totalItems || 0)) break;
    page += 1;
  }

  return keys;
}

export async function importHandler({ payload, ctx }) {
  ensureContext(ctx);
  const { moduleUserId, mainKey } = ctx;

  const clear = normalizePayload(payload);
  const { iv, data } = await encryptAESGCM(JSON.stringify(clear), mainKey);

  const id = await createEncryptedRecord({
    collection: meta.collection,
    moduleUserId,
    payloadString: String(data),
    iv: String(iv),
    mainKey,
  });

  return { action: "created", id };
}

export async function* exportQuery({ ctx, pageSize = 50, range } = {}) {
  ensureContext(ctx);
  const { mainKey, moduleUserId } = ctx;

  let page = 1;
  for (;;) {
    const data = await listRecords(meta.collection, {
      sid: moduleUserId,
      page,
      perPage: pageSize,
      sort: "+created",
    });
    const items = data?.items || [];
    if (!items.length) break;

    for (const r of items) {
      const plaintext = await decryptAESGCM(
        { iv: r.cipher_iv, data: r.payload },
        mainKey
      );
      const obj = JSON.parse(plaintext || "{}");

      if (range?.start || range?.end) {
        const d = obj?.date ? new Date(obj.date) : null;
        if (range?.start && (!d || d < new Date(range.start))) continue;
        if (range?.end && (!d || d > new Date(range.end))) continue;
      }

      yield obj;
    }

    if (page * pageSize >= (data?.totalItems || 0)) break;
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

const MoodImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default MoodImportExport;
