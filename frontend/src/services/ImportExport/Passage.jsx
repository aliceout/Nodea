// frontend/src/services/ImportExport/Passage.jsx
import pb from "@/services/pocketbase";
import {
  createPassageEntry,
  decryptPassageRecord,
} from "@/services/dataModules/Passage";
import { listRecords } from "@/services/pb-records";
import { normalizeKeyPart } from "@/services/ImportExport/utils";

/** Métadonnées module (même pattern que Mood.jsx) */
export const meta = {
  id: "passage",
  version: 1,
  collection: "passage_entries",
};

/** Normalisation du payload clair (thread requis, title optionnel) */
function normalizePayload(input) {
  const p = input || {};
  return {
    date: String(p.date || ""), // ex: "2025-09-10" ou ISO
    thread: String(p.thread || ""), // OBLIGATOIRE
    title: p.title ? String(p.title) : null, // optionnel
    content: String(p.content || ""), // requis
  };
}

/** Clé "naturelle" pour dédoublonner (date+thread) */
export function getNaturalKey(plain) {
  const p = normalizePayload(plain);
  // Couple (date, thread) — avec normalisation pour une dédup plus robuste
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(p.thread)}`;
}

/**
 * Import d’une entrée (contrat identique à Mood.jsx)
 * ctx = { moduleUserId, mainKey, log? }
 */
export async function importHandler({ payload, ctx }) {
  const { moduleUserId, mainKey, log } = ctx || {};
  const p = normalizePayload(payload);

  if (!p.thread || !p.content) {
    throw new Error(
      "Passage.import: payload invalide (thread et content requis)."
    );
  }
  if (!moduleUserId || !mainKey) {
    throw new Error(
      "Passage.import: contexte incomplet (moduleUserId/mainKey manquants)."
    );
  }

  const sealedPayload = {
    type: "passage.entry",
    date: p.date || new Date().toISOString(),
    thread: p.thread,
    title: p.title || null,
    content: p.content,
  };

  if (log) log(`Passage.import → create (${p.date} / ${p.thread})`);
  await createPassageEntry(moduleUserId, mainKey, sealedPayload);
}

/**
 * Générateur d’export (contrat identique à Mood.jsx)
 * ctx = { moduleUserId, mainKey, pageSize? }
 */
export async function* exportQuery({ ctx }) {
  const { moduleUserId, mainKey } = ctx || {};
  const perPage = ctx?.pageSize || 200;
  if (!moduleUserId || !mainKey) return;

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
          // On émet **seulement** le clair attendu par la doc
          yield {
            date: p.date,
            thread: p.thread,
            title: p.title,
            content: p.content,
          };
        }
      } catch {
        // on ignore silencieusement les entrées indéchiffrables
      }
    }

    if (!data.items || data.items.length < perPage) break;
    page++;
  }
}

/** Sérialisation d’un item d’export (même pattern que Mood.jsx / NDJSON friendly) */
export function exportSerialize(plainPayload) {
  // Retour simple : l’orchestrateur enveloppe déjà par module si besoin.
  // Si tu utilises un format NDJSON, tu peux aussi renvoyer `JSON.stringify({ module:"passage", version:meta.version, payload: plainPayload })`
  return {
    module: meta.id,
    version: meta.version,
    payload: plainPayload,
  };
}

/**
 * Liste des clés naturelles existantes pour éviter les doublons à l’import
 * (contrat identique à Mood.jsx)
 * ctx = { moduleUserId, mainKey }
 * Retourne un Set<string> de `${date}::${thread}`
 */
export async function listExistingKeys(args = {}) {
  // Supporte { pb, sid, mainKey } et fallback { ctx:{ moduleUserId, mainKey } }
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
    page++;
  }

  return keys;
}

/** Export par défaut (même façonnage que Mood.jsx) */
const PassageImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default PassageImportExport;
