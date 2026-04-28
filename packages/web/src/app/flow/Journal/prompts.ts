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
 * Tone guideline : open-ended, low-stakes, no « do this ». Tutoie.
 * Add new prompts at the end so existing days don't shift.
 */

const PROMPTS: ReadonlyArray<string> = [
  'Ce qui te traverse aujourd’hui — au long, sans contrainte.',
  'Qu’est-ce qui s’est joué dans ta journée ?',
  'Une chose que tu veux poser sur le papier…',
  'Un moment qui t’est resté en tête.',
  'Comment tu te sens, là, en ce moment précis ?',
  'Un détail de la journée qui mérite d’être noté.',
  'Ce que tu n’as pas eu le temps de dire à voix haute.',
  'Une pensée à laisser ici pour la relire plus tard.',
  'Si tu devais résumer ta journée en quelques lignes…',
  'Quelque chose que tu as appris cette semaine.',
  'Une rencontre, une lecture, une image qui t’a marqué·e.',
  'Ce que tu choisis de garder de cette journée.',
];

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

export function pickJournalPrompt(now: Date = new Date()): string {
  const idx = dayOfYear(now) % PROMPTS.length;
  return PROMPTS[idx]!;
}
