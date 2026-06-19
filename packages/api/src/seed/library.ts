import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import {
  LibraryItemPayloadSchema,
  LibraryReviewPayloadSchema,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { libraryItemsEntries, libraryReviewsEntries } from '../db/schema.ts';
import {
  deriveGuard,
  encryptJson,
  ensureModuleUserId,
  purgeModuleKeys,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildLibraryFixtures } from './library.fixtures.ts';

/**
 * Library seed — items + reviews.
 *
 * Library has three collections (items / reviews / covers) but they
 * **share a single `modules_config` key** (`library`) — the front
 * uses one sid for all three clients (`items` / `reviews` /
 * `covers`). Only items + reviews are seeded ; covers come from the
 * manual Composer flow (the lookup-by-ISBN path) and inflate the
 * fixture for little test value.
 *
 * Cross-reference handling : reviews carry an `itemRid` pointing to
 * their parent item's record id. The id is generated at insert time,
 * so we insert items first and remap each fixture's stable handle
 * to the freshly-minted id before encrypting the matching reviews.
 */
export async function seedLibrary(ctx: SeedContext): Promise<SeedResult> {
  // One-shot cleanup : the seed v1 created two separate
  // `library_items` / `library_reviews` keys in `modules_config`
  // (wrong — the front uses one shared `library` sid). Drop those
  // legacy keys + the orphan entries they own so the dataset
  // converges on the correct shape on first re-run.
  const orphanSids = await purgeModuleKeys(
    ctx.user.id,
    ['library_items', 'library_reviews'],
    ctx.aesKey,
  );
  let clearedOrphans = 0;
  if (orphanSids.length > 0) {
    const removedItems = await db
      .delete(libraryItemsEntries)
      .where(inArray(libraryItemsEntries.moduleUserId, orphanSids))
      .returning({ id: libraryItemsEntries.id });
    const removedReviews = await db
      .delete(libraryReviewsEntries)
      .where(inArray(libraryReviewsEntries.moduleUserId, orphanSids))
      .returning({ id: libraryReviewsEntries.id });
    clearedOrphans = removedItems.length + removedReviews.length;
  }

  const sid = await ensureModuleUserId(ctx.user.id, 'library', ctx.aesKey);

  // Wipe the user's library on every reseed so the dataset is
  // reproducible — covers are left alone since we don't write any.
  const clearedItems = await db
    .delete(libraryItemsEntries)
    .where(eq(libraryItemsEntries.moduleUserId, sid))
    .returning({ id: libraryItemsEntries.id });
  const clearedReviews = await db
    .delete(libraryReviewsEntries)
    .where(eq(libraryReviewsEntries.moduleUserId, sid))
    .returning({ id: libraryReviewsEntries.id });

  const fixtures = buildLibraryFixtures();

  // Pass 1 : build each item row (encrypt + guard) in parallel, record
  // its freshly-minted id, then insert the batch in one query.
  const idsByHandle = new Map<string, string>();
  const itemRows = await Promise.all(
    fixtures.map(async (fx) => {
      const payload = LibraryItemPayloadSchema.parse(fx.item);
      const id = randomUUID();
      const guard = await deriveGuard(ctx.hmacKey, sid, id);
      const blob = await encryptJson(ctx.aesKey, payload);
      idsByHandle.set(fx.handle, id);
      return {
        id,
        moduleUserId: sid,
        cipherIv: blob.iv,
        payload: blob.data,
        guard,
      };
    }),
  );
  if (itemRows.length > 0) await db.insert(libraryItemsEntries).values(itemRows);
  const insertedItems = itemRows.length;

  // Pass 2 : build every review row across all items (with its parent's
  // real id), then insert the flattened batch in one query.
  const reviewRows = await Promise.all(
    fixtures.flatMap((fx) => {
      const itemRid = idsByHandle.get(fx.handle);
      if (!itemRid) return [];
      return fx.reviews.map(async (review) => {
        const payload = LibraryReviewPayloadSchema.parse({
          ...review,
          itemRid,
        });
        const id = randomUUID();
        const guard = await deriveGuard(ctx.hmacKey, sid, id);
        const blob = await encryptJson(ctx.aesKey, payload);
        return {
          id,
          moduleUserId: sid,
          cipherIv: blob.iv,
          payload: blob.data,
          guard,
        };
      });
    }),
  );
  if (reviewRows.length > 0) {
    await db.insert(libraryReviewsEntries).values(reviewRows);
  }
  const insertedReviews = reviewRows.length;

  return {
    cleared: clearedItems.length + clearedReviews.length + clearedOrphans,
    inserted: insertedItems + insertedReviews,
  };
}
