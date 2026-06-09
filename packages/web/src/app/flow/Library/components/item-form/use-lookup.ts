/**
 * Custom hook : drives the LookupBar for the LibraryItem composer.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04) — the search dance
 * (ISBN vs free-text routing, abort-on-new-run, NDJSON streaming
 * snapshots, error handling) was ~70 LOC of imperative orchestration
 * inside the component. Pulling it out makes the component focus
 * on form state + JSX while keeping the search self-contained and
 * separately testable.
 *
 * Returns the search state + the operations the LookupBar consumes :
 *   - `searching` : true while a request (or stream) is in flight.
 *   - `error` : null on happy path, user-facing string when the
 *     lookup fails or yields zero results.
 *   - `results` : the latest accumulated `NormalisedBook[]`. Each
 *     stream snapshot replaces the array wholesale (it carries the
 *     full state, not a delta).
 *   - `open` : whether the result panel is open (toggled by
 *     `runSearch` and `dismiss`).
 *   - `runSearch(query, lang)` : kick off a lookup. Aborts the
 *     previous in-flight stream so late snapshots from a superseded
 *     query never clobber the new one.
 *   - `dismiss()` : close the panel + cancel any in-flight stream.
 *   - `setInput(value)` : controlled `searchInput` setter. Hosted
 *     here (rather than in the component) because the hook also
 *     needs to seed it on edit-mount.
 *   - `input` : the current search input value.
 *
 * `applyResult` stays in the component because it writes to all
 * the form fields — moving it here would force a 13-prop callback
 * surface that would be worse than the duplication.
 */
import { useEffect, useRef, useState } from 'react';
import type { NormalisedBook } from '@nodea/shared';

import {
  apiLibraryLookupByIsbn,
  isApiError,
  streamLibraryLookupByQuery,
} from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface LibraryLookupState {
  input: string;
  setInput: (next: string) => void;
  searching: boolean;
  error: string | null;
  results: NormalisedBook[];
  open: boolean;
  runSearch: (lang: string) => Promise<void>;
  dismiss: () => void;
}

export function useLibraryLookup(): LibraryLookupState {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<NormalisedBook[]>([]);
  const [open, setOpen] = useState(false);

  // AbortController for the in-flight streaming search. We cancel
  // the previous run when a new search starts before the old one
  // finished — otherwise late snapshots from the old query would
  // clobber the new results, and the API keeps doing wasted work
  // on connections nobody reads from.
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Run a metadata lookup. ISBN-shaped input goes through the
   * dedicated by-isbn endpoint (one merged result, batch). Free-text
   * goes through the NDJSON streaming endpoint : snapshots arrive
   * as each provider settles (Google Books in ~1 s, Open Library in
   * ~10 s, etc.) so the user sees results progressively rather than
   * staring at a spinner for the slowest provider's full window.
   */
  async function runSearch(lang: string): Promise<void> {
    const q = input.trim();
    if (!q) return;
    // Cancel any prior stream — its late snapshots would otherwise
    // overwrite our fresh results, and its `finally` would flip the
    // spinner off mid-new-run.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setSearching(true);
    setOpen(true);
    setResults([]);
    try {
      const stripped = q.replace(/[\s-]/g, '');
      const isPossibleIsbn = /^\d{10}$|^\d{13}$|^\d{9}[\dX]$/i.test(stripped);
      if (isPossibleIsbn) {
        // ISBN: a 13-digit code is unambiguous, no point streaming.
        const response = await apiLibraryLookupByIsbn({ isbn: stripped });
        if (abortRef.current !== ac) return; // superseded
        setResults(response.results);
        if (response.results.length === 0) {
          setError(t('library.lookup.noResults'));
        }
        return;
      }
      // Free-text: stream snapshots in. Each snapshot is the full
      // accumulated state, so we just replace.
      let lastResults: NormalisedBook[] = [];
      await streamLibraryLookupByQuery(
        { q, lang },
        {
          signal: ac.signal,
          onSnapshot: (snap) => {
            // Drop late snapshots from a superseded run.
            if (abortRef.current !== ac) return;
            lastResults = snap.results;
            setResults(snap.results);
          },
        },
      );
      if (abortRef.current !== ac) return; // superseded
      if (lastResults.length === 0) {
        setError(t('library.lookup.noResults'));
      }
    } catch (err) {
      // AbortError on stream cancellation is expected and not user-
      // facing — happens when the user fires a new search.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (abortRef.current !== ac) return; // superseded
      if (isApiError(err) && err.status === 429) {
        setError(t('library.lookup.rateLimited'));
      } else {
        setError(t('library.lookup.unavailable'));
        if (import.meta.env.DEV) console.warn('library lookup failed', err);
      }
    } finally {
      // Only flip the spinner off if we're still the latest run —
      // otherwise an aborted stream would clear the indicator out
      // from under the new search that just started.
      if (abortRef.current === ac) setSearching(false);
    }
  }

  function dismiss(): void {
    abortRef.current?.abort();
    setOpen(false);
    setResults([]);
    setError(null);
    setSearching(false);
  }

  // Abort any in-flight stream when the consumer unmounts (modal
  // closes mid-search). The fetch / reader stop cleanly, the API
  // stops pushing snapshots into a connection nobody is reading.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    input,
    setInput,
    searching,
    error,
    results,
    open,
    runSearch,
    dismiss,
  };
}
