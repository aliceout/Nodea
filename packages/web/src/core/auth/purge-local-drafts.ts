/**
 * Remove every locally persisted draft slot from localStorage.
 *
 * Lives in `core/auth/` because its only callers are the auth
 * lifecycle paths (logout, account deletion via logout) — the
 * draft hooks themselves (`useJournalDraft`, `useGoalDraft`,
 * `Review/hooks/useDraft`) own the per-module write/read logic.
 *
 * Why this exists (audit 2026-06) : draft *content* is encrypted
 * under the main key before it touches localStorage, but the
 * storage **key names** (`nodea:journal:draft:new`, …) and their
 * plaintext `savedAt` timestamps reveal which modules a user has
 * been writing in, and when — to anyone opening the browser's
 * storage on a shared computer after logout. Same leak class as
 * the `nodea:library:viewMode` key that was migrated into the
 * encrypted preferences blob for exactly this reason.
 *
 * The match is prefix+substring (`nodea:` + `:draft`) rather than
 * an explicit list so a future module's draft hook is covered by
 * default — the convention is enforced by the existing hooks'
 * naming (`nodea:<module>:draft:<slot>`).
 */
export function purgeLocalDrafts(): void {
  if (typeof localStorage === 'undefined') return;
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith('nodea:') && key.includes(':draft')) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage quota / privacy-mode errors — nothing actionable,
      // the slot will be overwritten on next draft save anyway.
    }
  }
}
