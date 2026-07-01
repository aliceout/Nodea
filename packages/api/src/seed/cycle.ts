import { CyclePayloadSchema, type CyclePayload } from '@nodea/shared';
import { cycleEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildCycleFixtures } from './cycle.fixtures.ts';

/**
 * Cycle seed — encrypts every fixture under the user's AES key and
 * inserts a fresh row in `cycle_entries`. Idempotent : re-running
 * wipes the user's existing rows first.
 */
export async function seedCycle(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'cycle', ctx.aesKey);
  const fixtures: CyclePayload[] = buildCycleFixtures().map((f) =>
    CyclePayloadSchema.parse(f),
  );
  return replaceEntries(cycleEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
