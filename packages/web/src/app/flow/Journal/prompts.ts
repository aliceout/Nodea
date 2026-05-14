import promptsEn from './data/prompts-en.json';
import promptsFr from './data/prompts-fr.json';

/**
 * Daily writing-prompt placeholder for the Journal Composer.
 *
 * The Composer's content surface used to show a single hardcoded
 * placeholder (« Ce qui te traverse aujourd'hui… »). Rotating it
 * day-by-day surfaces gentle different angles into a journal habit
 * without ever forcing the user to follow them — placeholders
 * vanish the moment the surface receives any input.
 *
 * Selection is **deterministic per calendar day** rather than
 * random : opening the Composer twice on the same day shows the
 * same prompt, which avoids the « slot-machine » feel and lets the
 * prompt act like a daily orientation rather than ambient noise.
 *
 * Why this lives under `app/flow/Journal/data/` and not
 * `i18n/locales/`: the prompts are editorial content (open-ended
 * suggestions, not UI chrome), and the `t()` helper returns a
 * string — not an array. Same trade-off as `Mood/data/questions.ts`.
 *
 * Tone guideline : open-ended, low-stakes, no « do this ». Tutoie
 * the FR list, second-person the EN one. Add new prompts at the
 * end so existing days don't shift.
 */

const PROMPTS_BY_LANGUAGE: Record<string, ReadonlyArray<string>> = {
  fr: promptsFr,
  en: promptsEn,
};

/**
 * Day-of-year index — 1-based, January 1st = 1. UTC-agnostic
 * (uses local date components, same as the rest of the journal
 * date logic).
 */
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (24 * 3600 * 1000));
}

export function pickJournalPrompt(language: string, now: Date = new Date()): string {
  const pool = PROMPTS_BY_LANGUAGE[language] ?? promptsFr;
  if (pool.length === 0) return '';
  const idx = dayOfYear(now) % pool.length;
  return pool[idx]!;
}
