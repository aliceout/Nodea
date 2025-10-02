// frontend/src/services/ImportExport/Goals.jsx
// Import/Export du module "Goals" (aligné Mood/Passage)
// Contrat (plugins): { meta, importHandler, exportQuery, exportSerialize, getNaturalKey, listExistingKeys }
// Payload clair: { date, title, note?, status, thread }

import pb from "@/core/api/pocketbase";
import { encryptAESGCM, decryptAESGCM } from "@/core/crypto/webcrypto";
import { normalizeKeyPart } from "@/core/utils/ImportExport/utils";
import { createEncryptedRecord, listRecords } from "@/core/api/pb-records";

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

  // Création + promotion via helper centralisé
  const id = await createEncryptedRecord({
    collection: meta.collection,
    moduleUserId,
    payloadString: String(data),
    iv: String(iv),
    mainKey,
  });

  return { action: "created", id };
}

/* ---------------------------------- Export --------------------------------- */
// exportQuery: génére des payloads CLAIRS déjà déchiffrés
export async function* exportQuery({ ctx, pageSize = 200 } = {}) {
  const { moduleUserId, mainKey } = ctx || {};
  if (!moduleUserId || !mainKey) return;

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
