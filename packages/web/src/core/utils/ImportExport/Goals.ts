import { goalsClient } from '@/core/api/modules/goals';
import { normalizeKeyPart } from '@/core/utils/ImportExport/utils';
import type {
  ImportExportPlugin,
  ImportExportPluginCtx,
  ImportExportPluginMeta,
} from './types.ts';

export const meta: ImportExportPluginMeta = {
  id: 'goals',
  version: 1,
  collection: 'goals_entries',
};

const VALID_STATUSES = ['active', 'done', 'archived', 'open', 'wip'] as const;
type GoalStatus = (typeof VALID_STATUSES)[number];

interface RawGoalsPayload {
  date?: unknown;
  title?: unknown;
  status?: unknown;
  thread?: unknown;
  note?: unknown;
}

interface NormalisedGoalsPayload {
  date: string;
  title: string;
  status: GoalStatus;
  thread: string;
  note?: string;
}

function ensureContext(ctx: ImportExportPluginCtx | undefined): asserts ctx is ImportExportPluginCtx {
  if (!ctx) throw new Error('goals: ctx manquant');
  if (!ctx.moduleUserId) throw new Error('goals: moduleUserId manquant dans ctx');
  if (!ctx.mainKey) throw new Error('goals: mainKey manquante dans ctx');
}

function isValidStatus(value: unknown): value is GoalStatus {
  return (
    typeof value === 'string' &&
    (VALID_STATUSES as readonly string[]).includes(value)
  );
}

function normalizePayload(input: unknown): NormalisedGoalsPayload {
  const p = (input ?? {}) as RawGoalsPayload;
  const out: NormalisedGoalsPayload = {
    date: String(p.date ?? ''),
    title: String(p.title ?? ''),
    status: isValidStatus(p.status) ? p.status : 'active',
    thread: String(p.thread ?? ''),
  };
  if (p.note != null) out.note = String(p.note);
  return out;
}

export function getNaturalKey(plain: unknown): string | null {
  const p = normalizePayload(plain);
  return `${normalizeKeyPart(p.date)}::${normalizeKeyPart(
    p.thread,
  )}::${normalizeKeyPart(p.title)}`;
}

export async function importHandler({
  payload,
  ctx,
}: {
  payload: unknown;
  ctx: ImportExportPluginCtx;
}): Promise<{ action: 'created'; id: string }> {
  ensureContext(ctx);
  const clear = normalizePayload(payload);
  // TODO(health.md Tier B.7) — plugin payload predates the
  // current GoalsPayloadSchema ; cast at the boundary until the
  // rewire lands.
  const rec = await goalsClient.create(
    ctx.moduleUserId,
    ctx.mainKey,
    clear as Parameters<typeof goalsClient.create>[2],
  );
  return { action: 'created', id: rec.id };
}

export async function* exportQuery({
  ctx,
}: {
  ctx: ImportExportPluginCtx;
}): AsyncIterable<unknown> {
  ensureContext(ctx);
  const list = await goalsClient.list(ctx.moduleUserId, ctx.mainKey);
  for (const rec of list) {
    yield normalizePayload(rec.payload);
  }
}

export function exportSerialize(plainPayload: unknown): {
  module: string;
  version: number;
  payload: unknown;
} {
  return { module: meta.id, version: meta.version, payload: plainPayload };
}

export async function listExistingKeys({
  sid,
  mainKey,
}: {
  sid: string;
  mainKey: ImportExportPluginCtx['mainKey'];
}): Promise<Set<string>> {
  if (!sid) throw new Error('goals: listExistingKeys — sid manquant');
  if (!mainKey) throw new Error('goals: listExistingKeys — mainKey manquante');

  const keys = new Set<string>();
  const list = await goalsClient.list(sid, mainKey);
  for (const rec of list) {
    const key = getNaturalKey(rec.payload);
    if (key) keys.add(key);
  }
  return keys;
}

const GoalsImportExport: ImportExportPlugin = {
  meta,
  importHandler,
  exportQuery,
  exportSerialize,
  getNaturalKey,
  listExistingKeys,
};

export default GoalsImportExport;
