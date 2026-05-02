/**
 * Pure async orchestrator for "save library item" — the heart of
 * the LibraryItem composer body.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04) because it was the
 * single biggest chunk in the file (150 LOC of validation +
 * payload assembly + create/update branching + best-effort cover
 * persistence). Pulling it out keeps the React component focused
 * on UI state ; this module owns the data flow.
 *
 * Returns a discriminated result :
 *   - `{ ok: true }` — saved (item + cover where applicable). The
 *     caller bumps the items version and closes the modal.
 *   - `{ ok: false, error }` — validation failed (title missing,
 *     year malformed, module not hydrated) OR a network round-trip
 *     threw. The caller surfaces `error` to the user via
 *     `setError(...)`.
 *
 * **Cover persistence is best-effort** on both branches : a cover
 * proxy hiccup never rolls back the book record. Better to have a
 * book without a cover than to lose the typed form to a flaky
 * upstream provider.
 */
import type {
  LibraryFormat,
  LibraryItemPayload,
  LibraryStatus,
} from '@nodea/shared';

import { apiLibraryFetchCover } from '@/core/api/client';
import {
  libraryCoversClient,
  libraryItemsClient,
} from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';

import { normaliseAuthorName } from '../../lib/format';

export interface SaveLibraryItemFields {
  title: string;
  author: string;
  isbn: string;
  year: string;
  publisher: string;
  collection: string;
  summary: string;
  seriesName: string;
  seriesPosition: string;
  status: LibraryStatus;
  format: LibraryFormat;
  tagsInput: string;
  /** When set, the URL of a cover preview that the user picked
   *  from the lookup. Will be downloaded via the cover proxy and
   *  stored as an encrypted blob alongside the item. */
  coverUrl: string | null;
}

export interface SaveLibraryItemInput {
  ctx: ModuleClient | null;
  /** When non-null, switches the orchestrator to the update path —
   *  preserves `cover_rid` / `started_at` / `finished_at` / `rating`
   *  / `is_favorite` from `payload` (those aren't editable in the
   *  composer) and patches the rest. */
  editing: { id: string; payload: LibraryItemPayload } | null;
  fields: SaveLibraryItemFields;
}

export type SaveLibraryItemResult = { ok: true } | { ok: false; error: string };

export async function saveLibraryItem(
  input: SaveLibraryItemInput,
): Promise<SaveLibraryItemResult> {
  const { ctx, editing, fields } = input;

  const trimmedTitle = fields.title.trim();
  if (!trimmedTitle) {
    return { ok: false, error: 'Le titre est requis.' };
  }
  if (!ctx) {
    return {
      ok: false,
      error: 'Module Library non configuré ou clé absente — reconnecte-toi.',
    };
  }
  if (fields.year && !/^\d{4}$/.test(fields.year)) {
    return { ok: false, error: 'L’année doit être un nombre à 4 chiffres.' };
  }

  try {
    const trimmedAuthor = fields.author.trim();
    const normalisedAuthor = trimmedAuthor
      ? normaliseAuthorName(trimmedAuthor)
      : '';
    const isbnTrimmed = fields.isbn.replace(/[\s-]/g, '');
    const providers: Record<string, string> = {};
    if (isbnTrimmed.length === 13) providers.isbn13 = isbnTrimmed;
    else if (isbnTrimmed.length === 10) providers.isbn10 = isbnTrimmed;

    const tags = fields.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const basePayload = editing?.payload ?? null;
    const payload = {
      // Schema defaults are not applied by zod on the input side
      // (they're "fill-in-on-parse"), so the create/update typing
      // requires every nullable field to be explicitly present.
      // We seed with sensible defaults, then let the editing
      // payload override what the user already had.
      type: 'book' as const,
      title: trimmedTitle,
      creators: normalisedAuthor
        ? [{ name: normalisedAuthor, role: 'author' }]
        : [],
      cover_rid: basePayload?.cover_rid ?? null,
      status: fields.status,
      format: fields.format,
      started_at: basePayload?.started_at ?? null,
      finished_at: basePayload?.finished_at ?? null,
      rating: basePayload?.rating ?? null,
      is_favorite: basePayload?.is_favorite ?? false,
      tags,
      ...(Object.keys(providers).length > 0
        ? { providers }
        : basePayload?.providers
          ? { providers: basePayload.providers }
          : {}),
      ...(fields.year ? { year: Number(fields.year) } : {}),
      ...(fields.publisher.trim()
        ? { publisher: fields.publisher.trim() }
        : {}),
      ...(fields.collection.trim()
        ? { collection: fields.collection.trim() }
        : {}),
      ...(fields.summary.trim() ? { summary: fields.summary.trim() } : {}),
      ...(fields.seriesName.trim()
        ? {
            series: {
              name: fields.seriesName.trim(),
              ...(fields.seriesPosition && /^\d+$/.test(fields.seriesPosition)
                ? { position: Number(fields.seriesPosition) }
                : {}),
            },
          }
        : {}),
    };

    if (editing) {
      // Edit path: cover swap mid-edit isn't wired (would need to
      // delete the old encrypted blob row and create a new one).
      // We just update the item, keeping the existing `cover_rid`
      // from `basePayload`. If the user wants to add a cover to a
      // book that didn't have one, that's still supported below.
      await libraryItemsClient.update(
        ctx.moduleUserId,
        ctx.mainKey,
        editing.id,
        payload,
      );
      if (fields.coverUrl && !basePayload?.cover_rid) {
        // Late-add a cover to an existing item: download via the
        // proxy, store the encrypted blob, then patch the item to
        // point at it. Best-effort — failure leaves the book without
        // a cover but doesn't roll back the rest of the edit.
        const fetched = await apiLibraryFetchCover(fields.coverUrl);
        if (fetched) {
          try {
            const newCover = await libraryCoversClient.create(
              ctx.moduleUserId,
              ctx.mainKey,
              {
                item_rid: editing.id,
                mime: fetched.mime,
                blob_b64: fetched.blob_b64,
                fetched_from: fields.coverUrl,
                fetched_at: new Date().toISOString(),
              },
            );
            await libraryItemsClient.update(
              ctx.moduleUserId,
              ctx.mainKey,
              editing.id,
              {
                ...payload,
                cover_rid: newCover.id,
              },
            );
          } catch (err) {
            if (import.meta.env.DEV)
              console.warn('cover persist failed', err);
          }
        }
      }
    } else {
      // Create path: race the item insert and the cover download —
      // they're independent (cover proxy lives on library-lookup,
      // not on the encrypted-records pipeline). Total wall-clock
      // is bounded by `max(itemCreate, coverFetch)` rather than
      // their sum.
      const [newItem, fetchedCover] = await Promise.all([
        libraryItemsClient.create(ctx.moduleUserId, ctx.mainKey, payload),
        fields.coverUrl
          ? apiLibraryFetchCover(fields.coverUrl)
          : Promise.resolve(null),
      ]);
      if (fields.coverUrl && fetchedCover) {
        // Cover save is best-effort on create: if the encrypted-blob
        // round-trip fails we still keep the book record. Better
        // than losing the typed-out form to a flaky cover proxy.
        try {
          const newCover = await libraryCoversClient.create(
            ctx.moduleUserId,
            ctx.mainKey,
            {
              item_rid: newItem.id,
              mime: fetchedCover.mime,
              blob_b64: fetchedCover.blob_b64,
              fetched_from: fields.coverUrl,
              fetched_at: new Date().toISOString(),
            },
          );
          await libraryItemsClient.update(
            ctx.moduleUserId,
            ctx.mainKey,
            newItem.id,
            {
              ...newItem.payload,
              cover_rid: newCover.id,
            },
          );
        } catch (err) {
          if (import.meta.env.DEV) console.warn('cover persist failed', err);
        }
      }
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
    };
  }
}
