/**
 * Mood composer — resolve WHERE each optional block goes from the encrypted
 * preferences, applying the migration default in one place.
 *
 * WHERE  `Mood/lib/`, consumed by `MoodForm` (what to render, and in which
 *        band) and `MoodSettings` (what the dropdowns show). Pure so the
 *        mapping — including the legacy fallback — has a single home + a test.
 * WHY    The question block predates the placement setting as a boolean
 *        (`moodOfferDailyQuestion`); a blob written before this feature must
 *        keep behaving (false ⇒ never offered ⇒ 'off', otherwise the drawer).
 *        The three-positives block had no setting before, so it simply
 *        defaults to the drawer.
 */
import type { MoodEntryLead, MoodSectionPlacement, UserPreferencesPayload } from '@nodea/shared';

export function moodQuestionPlacement(p: UserPreferencesPayload): MoodSectionPlacement {
  if (p.moodQuestionPlacement) return p.moodQuestionPlacement;
  return p.moodOfferDailyQuestion === false ? 'off' : 'accordion';
}

export function moodPositivesPlacement(p: UserPreferencesPayload): MoodSectionPlacement {
  return p.moodPositivesPlacement ?? 'accordion';
}

/** Canonical fallback order of the three entry-row blocks. */
const ENTRY_BLOCK_ORDER = ['positives', 'comment', 'question'] as const;

/**
 * Entry-list display order: the chosen `lead` block first, the other two in the
 * canonical order behind it. Pure so the ordering has one home + a test — used
 * by `EntryRow`.
 */
export function moodEntryOrder(lead: MoodEntryLead): MoodEntryLead[] {
  return [lead, ...ENTRY_BLOCK_ORDER.filter((k) => k !== lead)];
}
