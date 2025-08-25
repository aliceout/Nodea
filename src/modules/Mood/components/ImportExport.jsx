/**
 * Mood/ImportExport.jsx
 * Logique d'import/export du module "mood" (headless).
 * - Pas d'UI ni de style ici.
 * - À appeler depuis tes orchestratrices ImportData / ExportData.
 *
 * Hypothèses (adapte si besoin) :
 * - Collection PocketBase : "mood_entries"
 * - Clé naturelle : (module_user_id, date) → 1 entrée par date exacte
 * - Payload import/export : { date: ISOString, mood_score: 0..10, note?: string }
 * - ctx attendu : { pb, moduleUserId, guard } (mainKey si tu chiffrages en amont côté service)
 */

export const meta = { id: "mood", version: "1.0.0" };

/* ============================
 * VALIDATION & UTILS
 * ============================ */
function assertCtx(ctx) {
  if (!ctx?.pb) throw new Error("ctx.pb manquant");
  if (!ctx?.moduleUserId) throw new Error("ctx.moduleUserId manquant");
  if (!ctx?.guard) throw new Error("ctx.guard manquant");
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object")
    throw new Error("payload invalide");
  const { date, mood_score } = payload;

  // date ISO
  if (typeof date !== "string")
    throw new Error("payload.date doit être une chaîne ISO");
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error("payload.date ISO invalide");

  // mood_score 0..10 entier
  if (typeof mood_score !== "number" || !Number.isFinite(mood_score)) {
    throw new Error("payload.mood_score doit être un nombre");
  }
  if (mood_score % 1 !== 0)
    throw new Error("payload.mood_score doit être entier");
  if (mood_score < 0 || mood_score > 10)
    throw new Error("payload.mood_score ∈ [0,10]");
}

function sanitizeNote(note) {
  if (note == null) return undefined;
  if (typeof note !== "string") return String(note);
  return note;
}

function esc(str) {
  // Échappe les guillemets pour les filtres PB
  return String(str).replace(/"/g, '\\"');
}

/* ============================
 * IMPORT
 * ============================ */

/**
 * importHandler
 * - Idempotent par (module_user_id, date)
 * - Si une entrée existe à la même date → update ; sinon → create
 * - Retourne { action: 'created'|'updated', id }
 */
export async function importHandler({ payload, ctx }) {
  assertCtx(ctx);
  validatePayload(payload);

  const { pb, moduleUserId, guard } = ctx;
  const { date, mood_score } = payload;
  const note = sanitizeNote(payload.note);

  // 1) cherche une entrée existante sur la même date (clé naturelle)
  const filter = `module_user_id = "${esc(moduleUserId)}" && date = "${esc(
    date
  )}"`;

  let existing = null;
  try {
    existing = await pb.collection("mood_entries").getFirstListItem(filter, {
      fields: "id",
    });
  } catch {
    existing = null; // not found → on créera
  }

  // 2) upsert
  if (existing?.id) {
    const id = existing.id;
    await pb.collection("mood_entries").update(id, {
      date,
      mood_score,
      note,
      guard, // si la règle serveur l’exige
    });
    return { action: "updated", id };
  } else {
    const rec = await pb.collection("mood_entries").create({
      module_user_id: moduleUserId,
      date,
      mood_score,
      note,
      guard,
    });
    return { action: "created", id: rec.id };
  }
}

/* ============================
 * EXPORT
 * ============================ */

/**
 * exportQuery
 * - range?: { start?: ISOString, end?: ISOString }
 * - Retourne un itérateur async de records PB (bruts, déjà filtrés).
 *   Usage : for await (const rec of exportQuery({ range, ctx })) { ... }
 */
export async function* exportQuery({ range, ctx, pageSize = 50 }) {
  assertCtx(ctx);
  const { pb, moduleUserId } = ctx;

  // Filtre de base
  const parts = [`module_user_id = "${esc(moduleUserId)}"`];
  if (range?.start) parts.push(`date >= "${esc(range.start)}"`);
  if (range?.end) parts.push(`date <= "${esc(range.end)}"`);

  const filter = parts.join(" && ");

  // Pagination
  let page = 1;
  for (;;) {
    const list = await pb.collection("mood_entries").getList(page, pageSize, {
      filter,
      sort: "+date", // plus ancien → plus récent
      fields: "id,date,mood_score,note",
    });
    for (const item of list.items) yield item;
    if (page * pageSize >= list.totalItems) break;
    page += 1;
  }
}

/**
 * exportSerialize
 * - Transforme un record PB en ligne NDJSON standardisée
 * - Sortie : { module, version, payload }
 */
export function exportSerialize(record) {
  return {
    module: meta.id,
    version: meta.version,
    payload: {
      date: record.date,
      mood_score: record.mood_score,
      ...(record.note ? { note: record.note } : {}),
    },
  };
}

/* ============================
 * API DE FAÇADE (option)
 * ============================ */

const MoodImportExport = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
};

export default MoodImportExport;
