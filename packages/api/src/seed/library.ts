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

  // Pass 1 : insert each item, remember its freshly-minted id.
  const idsByHandle = new Map<string, string>();
  let insertedItems = 0;
  for (const fx of fixtures) {
    const payload = LibraryItemPayloadSchema.parse(fx.item);
    const id = randomUUID();
    const guard = await deriveGuard(ctx.hmacKey, sid, id);
    const blob = await encryptJson(ctx.aesKey, payload);
    await db.insert(libraryItemsEntries).values({
      id,
      moduleUserId: sid,
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
        itemRid: itemRid,
      });
      const id = randomUUID();
      const guard = await deriveGuard(ctx.hmacKey, sid, id);
      const blob = await encryptJson(ctx.aesKey, payload);
      await db.insert(libraryReviewsEntries).values({
        id,
        moduleUserId: sid,
        cipherIv: blob.iv,
        payload: blob.data,
        guard,
      });
      insertedReviews += 1;
    }
  }

  return {
    cleared: clearedItems.length + clearedReviews.length + clearedOrphans,
    inserted: insertedItems + insertedReviews,
  };
}
