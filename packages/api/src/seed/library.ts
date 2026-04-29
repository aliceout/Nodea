import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
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
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildLibraryFixtures } from './library.fixtures.ts';

/**
 * Library seed — items + reviews.
 *
 * Library has three collections (items / reviews / covers) but only
 * the first two are seeded ; covers come from the manual Composer
 * flow (the lookup-by-ISBN path) and inflate the fixture for little
 * test value.
 *
 * Cross-reference handling : reviews carry an `item_rid` pointing to
 * their parent item's record id. The id is generated at insert time,
 * so we insert items first and remap each fixture's stable handle
 * to the freshly-minted id before encrypting the matching reviews.
 *
 * Both module sids (`library_items` and `library_reviews`) are
 * provisioned in `modules_config` so the web's runtime store
 * surfaces them right away.
 */
export async function seedLibrary(ctx: SeedContext): Promise<SeedResult> {
  const itemsSid = await ensureModuleUserId(
    ctx.user.id,
    'library_items',
    ctx.aesKey,
  );
  const reviewsSid = await ensureModuleUserId(
    ctx.user.id,
    'library_reviews',
    ctx.aesKey,
  );

  // Wipe the user's library on every reseed so the dataset is
  // reproducible — covers are left alone since we don't write any.
  const clearedItems = await db
    .delete(libraryItemsEntries)
    .where(eq(libraryItemsEntries.moduleUserId, itemsSid))
    .returning({ id: libraryItemsEntries.id });
  const clearedReviews = await db
    .delete(libraryReviewsEntries)
    .where(eq(libraryReviewsEntries.moduleUserId, reviewsSid))
    .returning({ id: libraryReviewsEntries.id });

  const fixtures = buildLibraryFixtures();

  // Pass 1 : insert each item, remember its freshly-minted id.
  const idsByHandle = new Map<string, string>();
  let insertedItems = 0;
  for (const fx of fixtures) {
    const payload = LibraryItemPayloadSchema.parse(fx.item);
    const id = randomUUID();
    const guard = await deriveGuard(ctx.hmacKey, itemsSid, id);
    const blob = await encryptJson(ctx.aesKey, payload);
    await db.insert(libraryItemsEntries).values({
      id,
      moduleUserId: itemsSid,
      cipherIv: blob.iv,
      payload: blob.data,
      guard,
    });
    idsByHandle.set(fx.handle, id);
    insertedItems += 1;
  }

  // Pass 2 : insert each review with its parent item's real id.
  let insertedReviews = 0;
  for (const fx of fixtures) {
    const itemRid = idsByHandle.get(fx.handle);
    if (!itemRid) continue;
    for (const review of fx.reviews) {
      const payload = LibraryReviewPayloadSchema.parse({
        ...review,
        item_rid: itemRid,
      });
      const id = randomUUID();
      const guard = await deriveGuard(ctx.hmacKey, reviewsSid, id);
      const blob = await encryptJson(ctx.aesKey, payload);
      await db.insert(libraryReviewsEntries).values({
        id,
        moduleUserId: reviewsSid,
        cipherIv: blob.iv,
        payload: blob.data,
        guard,
      });
      insertedReviews += 1;
    }
  }

  return {
    cleared: clearedItems.length + clearedReviews.length,
    inserted: insertedItems + insertedReviews,
  };
}
