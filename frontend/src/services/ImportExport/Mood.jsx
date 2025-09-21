/**
 * Logique d'import/export du module "Mood" (headless).
 * - Minimaliste : API { meta, importHandler, exportQuery, exportSerialize } + hooks de dédoublonnage.
 * - Pas d’UI ici.
 *
 * Contrat (voir MODULES.md / SECURITY.md) :
 * - Table: mood_entries (payload chiffré + cipher_iv + guard hidden)
 * - LIST/VIEW: GET …/mood_entries?sid=<module_user_id>
 * - CREATE (2 temps):
 *     A) POST { module_user_id, payload, cipher_iv, guard:"init" }
 *     B) PATCH /{id}?sid=<module_user_id>&d=init  body { guard: "g_<HMAC>" }
 * - Export: on déchiffre localement puis on sérialise { module, version, payload }
 */

import pb from "@/services/pocketbase";
import { encryptAESGCM, decryptAESGCM } from "@/services/webcrypto";
import { normalizeKeyPart } from "@/services/ImportExport/utils";

export const meta = { id: "mood", version: 1, collection: "mood_entries" };

/* ----------------------------- Helpers Généraux ----------------------------- */

function assertCtx(ctx) {
  if (!ctx) throw new Error("ctx manquant");
  if (!ctx.moduleUserId) throw new Error("moduleUserId manquant dans ctx");
  if (!ctx.mainKey) throw new Error("mainKey manquante (clé AES) dans ctx");
}

const te = new TextEncoder();
function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
async function hmacSha256(keyRaw, messageUtf8) {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}
async function deriveGuard(mainKey, moduleUserId, recordId) {
  const guardKeyBytes = await hmacSha256(mainKey, `guard:${moduleUserId}`);
  const mac = await hmacSha256(guardKeyBytes, String(recordId));
  return `g_${toHex(mac)}`;
}

/** Normalise très légèrement le payload importé (tolérant) */
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

/* ======================= Hooks de dédoublonnage (Mood) ====================== */
/** Clé naturelle d'une entrée Mood (1/jour) */
export function getNaturalKey(payload) {
  if (!payload?.date) return null;
  // Keep shape YYYY-MM-DD, then normalize just in case of stray spaces/unicode
  const d = String(payload.date).slice(0, 10);
  return normalizeKeyPart(d);
}

/** Liste les clés déjà présentes (via ?sid + déchiffrement local) */
export async function listExistingKeys({ pb: pbClient, sid, mainKey }) {
  if (!sid || !mainKey)
    throw new Error("listExistingKeys: sid/mainKey manquant");
  const client = pbClient || pb;

  // pagination simple
  let page = 1;
  const perPage = 200;
  const keys = new Set();

  for (;;) {
    const res = await client
      .collection(meta.collection)
      .getList(page, perPage, {
        query: { sid, sort: "-created" },
        fields: "id,payload,cipher_iv",
      });
    const items = res?.items || [];
    if (!items.length) break;

    for (const it of items) {
      try {
        const clear = await decryptAESGCM(
          { iv: it.cipher_iv, data: it.payload },
          mainKey
        );
        const payload = JSON.parse(clear || "{}");
        const k = getNaturalKey(payload);
        if (k) keys.add(k);
      } catch {
        // ignore
      }
    }
    if (page * perPage >= (res?.totalItems || 0)) break;
    page++;
  }

  return keys;
}

/* ================================= IMPORT ================================== */
/**
 * importHandler
 * Appelé par l’orchestrateur d’import (Account/ImportData).
 * Signature : importHandler({ payload, ctx })
 * - payload : objet clair pour le module (cf. MODULES.md §Mood)
 * - ctx : { moduleUserId, mainKey }
 */
export async function importHandler({ payload, ctx }) {
  assertCtx(ctx);
  const { moduleUserId, mainKey } = ctx;

  // 1) Normaliser le payload clair
  const clear = normalizePayload(payload);

  // 2) Chiffrer localement (AES-GCM) → { iv, data } en base64
  const { iv, data } = await encryptAESGCM(JSON.stringify(clear), mainKey);

  // 3) CREATE (étape A) : POST avec guard="init"
  const created = await pb.send(`/api/collections/${meta.collection}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_user_id: String(moduleUserId),
      payload: String(data),
      cipher_iv: String(iv),
      guard: "init",
    }),
  });

  // 4) Promotion HMAC (étape B) : calcule le guard et PATCH avec ?sid=<sid>&d=init
  const guard = await deriveGuard(mainKey, moduleUserId, created?.id);
  await pb.send(
    `/api/collections/${meta.collection}/records/${
      created.id
    }?sid=${encodeURIComponent(moduleUserId)}&d=init`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guard }),
    }
  );

  return { action: "created", id: created.id };
}

/* ================================= EXPORT ================================== */
/**
 * exportQuery
 * - Retourne un itérateur asynchrone de payloads CLAIRS (déjà déchiffrés).
 * - range?: { start?: ISOString, end?: ISOString } (filtré côté client car la date est dans le payload).
 */
export async function* exportQuery({ ctx, pageSize = 50, range } = {}) {
  assertCtx(ctx);
  const { mainKey, moduleUserId } = ctx;

  let page = 1;
  for (;;) {
    const url = `/api/collections/${
      meta.collection
    }/records?page=${page}&perPage=${pageSize}&sort=+created&sid=${encodeURIComponent(
      moduleUserId
    )}`;
    const list = await pb.send(url, { method: "GET" });
    const items = list?.items || [];
    if (items.length === 0) break;

    for (const r of items) {
      const plaintext = await decryptAESGCM(
        { iv: r.cipher_iv, data: r.payload },
        mainKey
      );
      const obj = JSON.parse(plaintext || "{}");

      // Filtrage optionnel par date (payload clair)
      if (range?.start || range?.end) {
        const d = obj?.date ? new Date(obj.date) : null;
        if (range?.start && (!d || d < new Date(range.start))) continue;
        if (range?.end && (!d || d > new Date(range.end))) continue;
      }

      yield obj;
    }

    if (page * pageSize >= (list?.totalItems || 0)) break;
    page += 1;
  }
}

/**
 * exportSerialize
 * - Transforme un payload clair en ligne NDJSON standard { module, version, payload }
 * - (Le payload est déjà clair car exportQuery a déchiffré).
 */
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
  // hooks de dédoublonnage
  getNaturalKey,
  listExistingKeys,
};

export default MoodImportExport;
