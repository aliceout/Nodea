/**
 * Custom hook : on edit-mount, pre-seeds the LookupBar query with
 * the book's current ISBN (if any), else its `title author` combo.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04 follow-up) — lets the
 * user click « Chercher » immediately to refresh metadata from an
 * upstream provider without retyping their book's identity.
 *
 * Runs once per editing target — `editingId` is stable for a given
 * Composer open. We deliberately depend only on `editingId`: the
 * seed is a one-shot on Composer open, not a live mirror of the
 * form's state (the user can adjust the search input freely after
 * that).
 */
import { useEffect, useRef } from 'react';
import type { LibraryItemPayload } from '@nodea/shared';

export interface UseLookupSeedArgs {
  editingId: string | undefined;
  editingIsbn: string;
  editingPayload: LibraryItemPayload | undefined;
  editingCreatorName: string;
  setInput: (next: string) => void;
}

export function useLookupSeed(args: UseLookupSeedArgs): void {
  // The seed is a one-shot per editingId — not a live mirror of the
  // form's state (the user adjusts the search input freely after the
  // initial seed). A ref tracks « has this id already been seeded »
  // so we can list every dependency in the array without retriggering
  // the effect when the user edits the form.
  const argsRef = useRef(args);
  argsRef.current = args;
  const seededIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const current = argsRef.current;
    if (!current.editingId) return;
    if (seededIdRef.current === current.editingId) return;
    seededIdRef.current = current.editingId;

    const trimmedIsbn = current.editingIsbn.trim();
    if (trimmedIsbn) {
      current.setInput(trimmedIsbn);
      return;
    }
    const trimmedTitle = (current.editingPayload?.title ?? '').trim();
    const trimmedAuthor = current.editingCreatorName.trim();
    const seed = [trimmedTitle, trimmedAuthor].filter(Boolean).join(' ');
    if (seed) current.setInput(seed);
  }, [args.editingId]);
}
