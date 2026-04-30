import questionsEn from './questions-en.json';
import questionsFr from './questions-fr.json';

/**
 * « Question du jour » prompts shown in the Mood composer when the
 * user expands the optional fields. Bundled bilingual : the FR list
 * is the canonical original, the EN list mirrors it 1:1.
 *
 * Why this lives under `app/flow/Mood/data/` and not `i18n/locales/`:
 * the prompts are editorial content (open-ended questions, not UI
 * chrome), they're large (~100 entries × 2 locales), and the `t()`
 * helper returns a string — not an array. Keeping them as TS data
 * + a `pickQuestion(language)` selector keeps the call site one
 * line and stays out of the i18n namespace boundary.
 *
 * Adding a third language : drop `questions-<code>.json` next to
 * this file, register it in the map below. Locales without their
 * own list fall back to FR (the original — never empty).
 */
const QUESTIONS_BY_LANGUAGE: Record<string, ReadonlyArray<string>> = {
  fr: questionsFr,
  en: questionsEn,
};

/** Returns the question pool for `language`, falling back to FR
 *  when the locale has no localised list yet. */
export function getQuestionPool(language: string): ReadonlyArray<string> {
  return QUESTIONS_BY_LANGUAGE[language] ?? questionsFr;
}

/** Pick a random question for the given language. Returns the
 *  empty string only if the pool itself is empty (defensive — the
 *  bundled lists are never empty). */
export function pickQuestion(language: string): string {
  const pool = getQuestionPool(language);
  if (pool.length === 0) return '';
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? '';
}
