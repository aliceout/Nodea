import { GoalsPayloadSchema, type GoalsPayload } from '@nodea/shared';
import { goalsEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildGoalsFixtures } from './goals.fixtures.ts';

/**
 * Goals seed — encrypts each fixture under the user's AES key and
 * inserts a fresh row in `goals_entries`. Re-running wipes the
 * user's existing goals first so the dataset stays reproducible.
 */
export async function seedGoals(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'goals', ctx.aesKey);
  const fixtures: GoalsPayload[] = buildGoalsFixtures().map((f) =>
    GoalsPayloadSchema.parse(f),
  );
  return replaceEntries(goalsEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
