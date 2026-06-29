/**
 * « Conserver les brouillons après finalisation » — local-only preference.
 *
 * WHAT  A per-device on/off flag: when set, finalizing a review does NOT wipe
 *       its encrypted localStorage draft, so the user keeps a working copy on
 *       this machine.
 * WHERE Review module helper, beside the wizard that reads it on finalize and
 *       the settings panel that toggles it.
 * WHY local, not the encrypted prefs blob: the draft itself lives only in this
 *       browser's localStorage (see hooks/useDraft.ts), so "keep it or not" is a
 *       per-device choice that would be meaningless synced across devices. It is
 *       a boolean UI flag, not sensitive — but absent ⇒ false so the default
 *       behaviour (clear the draft on finalize) is preserved with zero data left
 *       behind unless the user explicitly opts in.
 */

const STORAGE_KEY = 'nodea:review:keepDraft';

/** True when drafts should be KEPT after finalization. Absent ⇒ false. */
export function reviewKeepDraft(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // localStorage unavailable (private mode quirks) — fall back to the
    // safe default of clearing drafts on finalize.
    return false;
  }
}

/** Persist the keep-draft choice. `true` writes '1'; `false` removes the key. */
export function setReviewKeepDraft(next: boolean): void {
  try {
    if (next) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — nothing to persist; the toggle just
    // won't stick this session.
  }
}
