// frontend/src/services/ImportExport/Goals.jsx
// Import/Export du module "Goals" (aligné Mood/Passage) – payload: { date, title, note?, status, thread }

import pb from "@/services/pocketbase";
import { encryptAESGCM, decryptAESGCM } from "@/services/webcrypto";
import { deriveGuard as deriveGuardShared } from "@/services/guards";
import { normalizeKeyPart } from "@/services/ImportExport/utils";

export const meta = { id: "goals", version: 1, collection: "goals_entries" };

/* ------------------------------ Normalisation ------------------------------ */
function normalizePayload(input) {
  const p = input || {};
  const out = {
    // Dans l’UI on saisit au format "YYYY-MM"; on ne force pas le jour ici
    date: String(p.date || ""),
    title: String(p.title || ""),
    status: ["open", "wip", "done"].includes(p.status) ? p.status : "done",
    thread: String(p.thread || ""),
  };
  if (p.note != null) out.note = String(p.note);
  return out;
}

/* ---------------------------- Clé naturelle (dedup) ---------------------------- */
// Hypothèse raisonnable (documentée) : une entrée Goal est identifiée par (date + title + thread).
// - date: "YYYY-MM" (mois de l’objectif)
// - title: texte libre
// - thread: hashtag libre (regroupement)
// Cette clé évite des doublons évidents lors d’imports multiples.
export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.thread
  )}::${normalizeKeyPart(p.title)}`;
}

/* ---------------------------------- Import --------------------------------- */
// Contrat identique à Mood/Passage: importHandler({ payload, ctx:{ moduleUserId, mainKey } })
export async function importHandler({ payload, ctx }) {
  if (!ctx?.moduleUserId || !ctx?.mainKey)
    throw new Error("Goals.import: contexte incomplet (moduleUserId/mainKey).");

  const { moduleUserId, mainKey } = ctx;
  const clear = normalizePayload(payload);

  // Chiffrement local (AES-GCM)
  const { iv, data } = await encryptAESGCM(JSON.stringify(clear), mainKey);

  // Création en 2 temps (guard: "init" → PATCH promotion via derive côté serveur)
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

  // Promotion guard avec helper partagé (cohérence inter-modules)
  const guard = await deriveGuardShared(mainKey, moduleUserId, created?.id);
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

/* ---------------------------------- Export --------------------------------- */
// exportQuery: génére des payloads CLAIRS déjà déchiffrés
export async function* exportQuery({ ctx, pageSize = 200 } = {}) {
  const { moduleUserId, mainKey } = ctx || {};
  if (!moduleUserId || !mainKey) return;

  let page = 1;
  while (true) {
    const url = `/api/collections/${
      meta.collection
    }/records?page=${page}&perPage=${pageSize}&sort=-created&sid=${encodeURIComponent(
      moduleUserId
    )}`;
    const res = await pb.send(url, { method: "GET" });
    const data = res?.json || res;
    const items = data?.items || [];
    if (!items.length) break;

    for (const rec of items) {
      try {
        const plaintext = await decryptAESGCM(
          { iv: rec.cipher_iv, data: rec.payload },
          mainKey
        );
        const obj = normalizePayload(JSON.parse(plaintext || "{}"));
        // On émet seulement le clair attendu
        yield obj;
      } catch {
        // ignore entrée indéchiffrable
      }
    }

    if (!data.items || data.items.length < pageSize) break;
    page++;
  }
}

export function exportSerialize(plainPayload) {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

// Déduplication: récupère les clés naturelles déjà présentes
export async function listExistingKeys(args = {}) {
  // Supporte deux signatures: ({ pb, sid, mainKey }) [utilisé par ImportData]
  // et ({ ctx: { moduleUserId, mainKey } }) [style Passage]
  const ctx = args.ctx || {};
  const moduleUserId = args.sid || ctx.moduleUserId;
  const mainKey = args.mainKey || ctx.mainKey;
  const client = args.pb || pb;

  const keys = new Set();
  if (!moduleUserId || !mainKey) return keys;

  let page = 1;
  const perPage = 200;
  while (true) {
    const url = `/api/collections/${
      meta.collection
    }/records?page=${page}&perPage=${perPage}&sort=-created&sid=${encodeURIComponent(
      moduleUserId
    )}`;
    const res = await client.send(url, { method: "GET" });
    const data = res?.json || res;
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
        // ignore
      }
    }

    if (!data.items || data.items.length < perPage) break;
    page++;
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
