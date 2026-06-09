/**
 * Custom hook : loads the existing cover when editing an item that
 * already has a `coverRid`.
 *
 * Fast path (audit 2026-06) : the form renders inside
 * `LibraryProvider`, whose data context ALREADY holds every cover as
 * a decrypted data URL (`covers: Map<coverRid, dataUrl>`). Reading
 * the Map is free ; the old behaviour re-downloaded + re-decrypted
 * the entire covers collection (10-20 MB at 300 books) to display
 * ONE thumbnail. The network fetch survives only as a fallback for
 * the rare miss (cover created after the provider's last fetch).
 *
 * Errors are swallowed silently — the Library page surfaces real
 * load errors. The form just renders without the cover thumb.
 *
 * The hook accepts setters rather than returning state because the
 * parent already owns `coverUrl` / `coverLoadFailed` (they're also
 * written by `applyResult` and the user picking a search result).
 * Keeping the state in one place avoids juggling two sources of
 * truth.
 */
import { useEffect } from 'react';

import { libraryCoversClient } from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';

export interface UseExistingCoverArgs {
  isEdit: boolean;
  coverRid: string | null;
  ctx: ModuleClient | null;
  /** Decrypted covers already held by the Library data context. */
  covers: ReadonlyMap<string, string>;
  setCoverUrl: (next: string | null) => void;
  setCoverLoadFailed: (next: boolean) => void;
}

export function useExistingCover(args: UseExistingCoverArgs): void {
  const { isEdit, coverRid, ctx, covers, setCoverUrl, setCoverLoadFailed } =
    args;
  useEffect(() => {
    if (!isEdit || !coverRid || !ctx) return undefined;

    const cached = covers.get(coverRid);
    if (cached) {
      setCoverUrl(cached);
      setCoverLoadFailed(false);
      return undefined;
    }

    let cancelled = false;
    libraryCoversClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const match = records.find((r) => r.id === coverRid);
        if (match) {
          setCoverUrl(`data:${match.payload.mime};base64,${match.payload.blobB64}`);
          setCoverLoadFailed(false);
        }
      })
      .catch(() => {
        // Silent — the Library page surfaces real load errors. The
        // form just renders without the cover thumb.
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, coverRid, ctx, covers, setCoverUrl, setCoverLoadFailed]);
}
