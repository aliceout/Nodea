/**
 * Custom hook : wraps `useGoalDraft` plus the two effects that
 * keep the Goal composer's form state in sync with its encrypted
 * draft slot — auto-restore on first surfacing of a stored draft,
 * and debounced auto-save on every value change.
 *
 * Extracted from `Goal.tsx` (decomposition follow-up). The parent
 * still owns the 11 `useState` slots — this hook receives the
 * current values + setters + `isEdit` flag, and exposes only the
 * `draftRestored` boolean banner-state plus a `resetDraft` helper
 * that clears state + storage in one shot.
 *
 * **Auto-restore semantics (preserved verbatim from the inline
 * version).** Skipped on edit (server payload is canonical),
 * skipped while hydrating, skipped if any input has been touched.
 * Gated by `draftRestored` so it fires once per Composer open.
 *
 * **Effect-dependency strategy.** Auto-restore reads the values
 * to decide whether the form is empty — but the setters it calls
 * also mutate those same values. Listing them in the dep array
 * naively would loop. We use a ref that mirrors the latest props
 * so the effect only re-runs when « actionable » deps change
 * (`isEdit`, `draftHydrating`, `draftHydrated`, `draftRestored`).
 * That avoids the `eslint-disable-next-line react-hooks/...` hack
 * while keeping behaviour identical.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useGoalDraft,
  type GoalDraftPayload,
} from '@/app/flow/Goals/hooks/useGoalDraft';

import { isCanonicalGoalStatus } from '../../lib/guards';
import type { GoalStatus } from '../../lib/constants';

export interface UseDraftCoordinationArgs {
  isEdit: boolean;
  title: string;
  setTitle: (next: string) => void;
  month: string;
  setMonth: (next: string) => void;
  year: string;
  setYear: (next: string) => void;
  status: GoalStatus;
  setStatus: (next: GoalStatus) => void;
  thread: string;
  setThread: (next: string) => void;
  note: string;
  setNote: (next: string) => void;
}

export interface UseDraftCoordinationResult {
  draftRestored: boolean;
  /** Nukes the in-memory form + the encrypted draft slot. Called
   *  by the « réinitialiser » button on the restored-banner and
   *  internally on successful create. */
  resetDraft: () => void;
  /** Forwards to `useGoalDraft.clear()` — lets the parent purge
   *  the slot after a successful `goalsClient.create` without
   *  also clearing the form values (the modal closes anyway). */
  clearDraft: () => void;
}

export function useDraftCoordination(
  args: UseDraftCoordinationArgs,
): UseDraftCoordinationResult {
  const {
    isEdit,
    title,
    setTitle,
    month,
    setMonth,
    year,
    setYear,
    status: _status,
    setStatus,
    thread,
    setThread,
    note,
    setNote,
  } = args;

  // New-entry path only — when editing, the server record is
  // the canonical state and a draft would clobber the prefill.
  const {
    hydrated: draftHydrated,
    hydrating: draftHydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useGoalDraft();

  const [draftRestored, setDraftRestored] = useState(false);

  // Mirror the latest values + setters into a ref so the auto-
  // restore effect can read them without re-triggering. We list
  // only the « actionable » deps in the effect's array.
  const argsRef = useRef(args);
  argsRef.current = args;

  // Auto-load any pending draft once it surfaces. Skipped on
  // edit, and skipped if the user has already typed something —
  // we don't want a draft to clobber active input.
  useEffect(() => {
    if (isEdit || draftHydrating || draftRestored) return;
    if (!draftHydrated) return;
    const current = argsRef.current;
    if (
      current.title.trim() !== '' ||
      current.thread.trim() !== '' ||
      current.note.trim() !== '' ||
      current.month !== '' ||
      current.year !== ''
    ) {
      return;
    }
    current.setTitle(draftHydrated.title);
    current.setMonth(draftHydrated.month);
    current.setYear(draftHydrated.year);
    current.setStatus(
      isCanonicalGoalStatus(draftHydrated.status) ? draftHydrated.status : 'open',
    );
    current.setThread(draftHydrated.thread);
    current.setNote(draftHydrated.note);
    setDraftRestored(true);
  }, [isEdit, draftHydrating, draftHydrated, draftRestored]);

  // Persist every change through the debounced draft hook.
  useEffect(() => {
    if (isEdit) return;
    const payload: GoalDraftPayload = {
      title,
      month,
      year,
      status: _status,
      thread,
      note,
    };
    saveDraft(payload);
  }, [title, month, year, _status, thread, note, isEdit, saveDraft]);

  const resetDraft = useCallback(() => {
    setTitle('');
    setMonth('');
    setYear('');
    setStatus('open');
    setThread('');
    setNote('');
    setDraftRestored(false);
    clearDraft();
  }, [setTitle, setMonth, setYear, setStatus, setThread, setNote, clearDraft]);

  return { draftRestored, resetDraft, clearDraft };
}
