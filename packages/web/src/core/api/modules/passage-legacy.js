/**
 * Legacy-shaped helpers for the Passage module.
 *
 * The restored Passage JSX (R5) was written against a PocketBase service
 * layer with this exact signature (`listPassageDecrypted`,
 * `createPassageEntry`, `deletePassageEntry`, `listDistinctThreads`).
 * Rather than rewrite the views, we adapt the typed `passageClient` to
 * the legacy shape here.
 */
import { passageClient } from "./passage.ts";

function shape(record) {
  return {
    id: record.id,
    created: record.createdAt,
    updated: record.updatedAt,
    payload: record.payload ?? {},
  };
}

function normalizePayload(input) {
  const p = input ?? {};
  return {
    type: "passage.entry",
    date: String(p.date ?? ""),
    thread: String(p.thread ?? ""),
    title: p.title ?? null,
    content: String(p.content ?? ""),
  };
}

/**
 * List every entry, decrypted, preserving the legacy `{ id, created,
 * updated, payload }` shape the history view expects.
 *
 * The `pages` / `perPage` / `sort` options are legacy PocketBase
 * paging hints. The new collection client returns every record in one
 * pass, so they're accepted but ignored — callers stay unchanged.
 */
export async function listPassageDecrypted(moduleUserId, mainKey /* , opts */) {
  const records = await passageClient.list(moduleUserId, mainKey);
  const mapped = records.map(shape);
  // Latest first — matches the legacy `sort: "-created"`.
  mapped.sort((a, b) => (a.created < b.created ? 1 : -1));
  return mapped;
}

export async function createPassageEntry(moduleUserId, mainKey, payload) {
  const rec = await passageClient.create(
    moduleUserId,
    mainKey,
    normalizePayload(payload),
  );
  return shape(rec);
}

export async function deletePassageEntry(id, moduleUserId, mainKey) {
  await passageClient.remove(moduleUserId, mainKey, id);
}

/**
 * Distinct `thread` values across the history. Legacy callers pass
 * paging options (`{ pages, perPage }`) — ignored here, the client
 * streams the whole set.
 */
export async function listDistinctThreads(moduleUserId, mainKey /* , opts */) {
  const records = await passageClient.list(moduleUserId, mainKey);
  const set = new Set();
  for (const record of records) {
    const thread = String(record.payload?.thread ?? "").trim();
    if (thread) set.add(thread);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
