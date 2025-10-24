import { encryptAESGCM, decryptAESGCM } from "@/core/crypto/webcrypto";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";
import { createEncryptedRecord, listRecords } from "@/core/api/pb-records";

export const meta = { id: "goals", version: 1, collection: "goals_entries" };

function ensureMainKey(mainKey) {
  if (!hasMainKeyMaterial(mainKey)) {
    throw new Error("Cle principale manquante pour le module Goals.");
  }
}

function normalizePayload(input) {
  const p = input || {};
  const out = {
    date: String(p.date || ""),
    title: String(p.title || ""),
    status: ["open", "wip", "done"].includes(p.status) ? p.status : "done",
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
  if (!ctx?.moduleUserId) {
    throw new Error("Goals.import: moduleUserId manquant.");
  }
  ensureMainKey(ctx.mainKey);

  const clear = normalizePayload(payload);
  const { iv, data } = await encryptAESGCM(JSON.stringify(clear), ctx.mainKey);

  const id = await createEncryptedRecord({
    collection: meta.collection,
    moduleUserId: ctx.moduleUserId,
    payloadString: String(data),
    iv: String(iv),
    mainKey: ctx.mainKey,
  });

  return { action: "created", id };
}

export async function* exportQuery({ ctx, pageSize = 200 } = {}) {
  const moduleUserId = ctx?.moduleUserId;
  const mainKey = ctx?.mainKey;
  if (!moduleUserId) return;
  if (!hasMainKeyMaterial(mainKey)) return;

  let page = 1;
  while (true) {
    const data = await listRecords(meta.collection, {
      sid: moduleUserId,
      page,
      perPage: pageSize,
      sort: "-created",
    });
    const items = data?.items || [];
    if (!items.length) break;

    for (const rec of items) {
      try {
        const plaintext = await decryptAESGCM(
          { iv: rec.cipher_iv, data: rec.payload },
          mainKey
        );
        const obj = normalizePayload(JSON.parse(plaintext || "{}"));
        yield obj;
      } catch {
        // ignore entries that cannot be decrypted
      }
    }

    if (!data.items || data.items.length < pageSize) break;
    page += 1;
  }
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
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
        const plaintext = await decryptAESGCM(
          { iv: rec.cipher_iv, data: rec.payload },
          mainKey
        );
        const obj = JSON.parse(plaintext || "{}");
        const k = getNaturalKey(obj);
        if (k) keys.add(k);
      } catch {
        // ignore errors
      }
    }

    if (!data.items || data.items.length < perPage) break;
    page += 1;
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
