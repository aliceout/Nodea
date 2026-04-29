import { ReviewPayloadSchema, type ReviewPayload } from '@nodea/shared';
import { reviewEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildReviewFixtures } from './review.fixtures.ts';

/**
 * Review (YearCompass) seed — encrypts each fixture under the
 * user's AES key and inserts a fresh row in `review_entries`.
 * Re-running wipes the user's existing reviews first.
 */
export async function seedReview(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'review', ctx.aesKey);
  const fixtures: ReviewPayload[] = buildReviewFixtures().map((f) =>
    ReviewPayloadSchema.parse(f),
  );
  return replaceEntries(reviewEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
