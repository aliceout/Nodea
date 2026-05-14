/**
 * Custom hook : pulls existing thread tokens from every stored goal
 * so the Goal composer can suggest them as chips below the thread
 * input. Splits each goal's `thread` field on commas (the multi-
 * thread convention) and dedupes.
 *
 * Extracted from `Goal.tsx` (decomposition follow-up) — keeps the
 * parent body focused on form state and orchestration. Owns its own
 * state internally and returns a stable `string[]` (sorted, locale
 * `fr`).
 *
 * Resolves to `[]` when the module client isn't hydrated yet, when
 * the list call fails, or when the user has no goals saved. The
 * caller can then conditionally render the chip strip — empty list
 * means « rien à proposer ».
 */
import { useEffect, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import type { ModuleClient } from '@/core/modules/use-module-client';

export function useThreadTokens(ctx: ModuleClient | null): string[] {
  const [threadOptions, setThreadOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    goalsClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const r of records) {
          const raw = r.payload.thread ?? '';
          for (const t of raw.split(',')) {
            const trimmed = t.trim();
            if (trimmed) set.add(trimmed);
          }
        }
        setThreadOptions(Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')));
      })
      .catch(() => {
        if (cancelled) return;
        setThreadOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  return threadOptions;
}
