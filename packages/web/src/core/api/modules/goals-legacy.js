/**
 * Legacy-shaped helpers for the Goals module.
 *
 * The restored Goals JSX (R4) was written against a PocketBase service
 * layer with this exact signature (`listGoals`, `getGoalById`,
 * `createGoal`, `updateGoal`, `deleteGoal`, `updateGoalStatus`,
 * `listDistinctThreads`). Rather than rewrite 7 files, we adapt the
 * typed `goalsClient` to the legacy shape here — flat entries
 * (`{ id, date, title, note, status, thread }`) in, flat entries out.
 */
import { goalsClient } from "./goals.ts";

function flatten(record) {
  const p = record?.payload ?? {};
  return {
    id: record.id,
    created: record.createdAt,
    updated: record.updatedAt,
    date: p.date ?? "",
    title: p.title ?? "",
    note: p.note ?? "",
    status: p.status ?? "open",
    thread: p.thread ?? "",
  };
}

function unflatten(entry) {
  return {
    date: entry?.date ?? "",
    title: entry?.title ?? "",
    note: entry?.note ?? "",
    status: entry?.status ?? "open",
    thread: entry?.thread ?? "",
  };
}

export async function listGoals(moduleUserId, mainKey /* , opts */) {
  const records = await goalsClient.list(moduleUserId, mainKey);
  return records.map(flatten);
}

export async function getGoalById(moduleUserId, mainKey, id /* , opts */) {
  const records = await goalsClient.list(moduleUserId, mainKey);
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error("Objectif introuvable.");
  return flatten(record);
}

export async function createGoal(moduleUserId, mainKey, payload) {
  const rec = await goalsClient.create(moduleUserId, mainKey, unflatten(payload));
  return flatten(rec);
}

export async function updateGoal(moduleUserId, mainKey, id, payload) {
  const rec = await goalsClient.update(moduleUserId, mainKey, id, unflatten(payload));
  return flatten(rec);
}

export async function deleteGoal(moduleUserId, mainKey, id) {
  await goalsClient.remove(moduleUserId, mainKey, id);
}

/**
 * Toggle the lifecycle status on an existing entry. `prevEntry` carries
 * the rest of the payload so we don't need to fetch it again.
 */
export async function updateGoalStatus(moduleUserId, mainKey, id, next, prevEntry) {
  const payload = unflatten({ ...prevEntry, status: next });
  await goalsClient.update(moduleUserId, mainKey, id, payload);
}

/**
 * Reconstruct the set of distinct `thread` values across every entry,
 * so the form autosuggest can offer existing hashtags.
 *
 * This decrypts the full history client-side — the same cost the legacy
 * pipeline paid. Paging lives here as a future optimisation.
 */
export async function listDistinctThreads(moduleUserId, mainKey /* , opts */) {
  const records = await goalsClient.list(moduleUserId, mainKey);
  const set = new Set();
  for (const record of records) {
    const thread = String(record.payload?.thread ?? "").trim();
    if (thread) set.add(thread);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
