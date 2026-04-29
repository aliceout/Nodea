import type { MoodScore } from '@nodea/shared';

/** Display name preference : `username` if set, else email
 *  local-part. Empty string when the user hasn't loaded yet (so
 *  the JSX can render « Bonjour. » instead of « Bonjour, . »). */
export function preferredName(
  user: { username?: string | null; email?: string } | null | undefined,
): string {
  if (!user) return '';
  const trimmed = user.username?.trim();
  if (trimmed) return trimmed;
  const email = user.email;
  if (!email) return '';
  const [local] = email.split('@');
  return local ?? '';
}

/** Signed score string : `+1`, `−2`, `0`. Mood scores are stored
 *  as strings so this is a string-in / string-out helper. */
export function signedScore(s: MoodScore): string {
  return Number(s) > 0 ? `+${s}` : s;
}

/** Local-TZ `HH:MM` from any ISO timestamp. Empty string on
 *  invalid input — the caller renders nothing when this returns
 *  empty. */
export function formatTimeFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Format a 30-day rolling average for display. Signed values
 *  use the FR-friendly unicode minus and a comma decimal. */
export function formatMoodAvg(avg: number): string {
  const sign = avg > 0 ? '+' : avg < 0 ? '−' : '';
  const abs = Math.abs(avg).toFixed(1).replace('.', ',');
  return `${sign}${abs}`;
}

/** Local-TZ ISO date (`YYYY-MM-DD`) for a `Date`, no time
 *  component. Used by the home frise to look entries up by day. */
export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// `firstThread` lives in `@nodea/shared/threads` since the
// post-`module-refacto` dedup. Importers should pull it from
// there directly — this barrel doesn't re-export it (one less
// indirection between caller and the source of truth).
