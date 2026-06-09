/**
 * Custom hook : loads the existing cover when editing an item that
 * already has a `coverRid`.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04 follow-up) — keeps the
 * parent component focused on form-state orchestration. The hook
 * lists every cover record under the user's sid, picks the one whose
 * record id matches `coverRid`, and reconstructs the data URL — same
 * recipe as the Library page's `buildCoverMap`. Bulk list is cheaper
 * than a 1-record fetch endpoint we don't have, and the cover
 * collection is small per user.
 *
 * Errors are swallowed silently — the Library page surfaces real
 * load errors. The composer just renders without the cover thumb.
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
  setCoverUrl: (next: string | null) => void;
  setCoverLoadFailed: (next: boolean) => void;
}

export function useExistingCover(args: UseExistingCoverArgs): void {
  const { isEdit, coverRid, ctx, setCoverUrl, setCoverLoadFailed } = args;
  useEffect(() => {
    if (!isEdit || !coverRid || !ctx) return undefined;
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
        // composer just renders without the cover thumb.
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, coverRid, ctx, setCoverUrl, setCoverLoadFailed]);
}
