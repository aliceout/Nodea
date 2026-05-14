import { MoodPayloadSchema, type MoodPayload } from '@nodea/shared';
import { moodEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildMoodFixtures } from './mood.fixtures.ts';

/**
 * Mood seed — encrypts every fixture under the user's AES key and
 * inserts a fresh row in `mood_entries`. Re-running wipes the
 * user's existing rows first so the dataset stays reproducible.
 */
export async function seedMood(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'mood', ctx.aesKey);
  const fixtures: MoodPayload[] = buildMoodFixtures().map((f) =>
    MoodPayloadSchema.parse(f),
  );
  return replaceEntries(moodEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
