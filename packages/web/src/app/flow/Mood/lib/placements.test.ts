import type { UserPreferencesPayload } from '@nodea/shared';
import { describe, expect, it } from 'vitest';

import { moodEntryOrder, moodPositivesPlacement, moodQuestionPlacement } from './placements';

const prefs = (p: Partial<UserPreferencesPayload>): UserPreferencesPayload =>
  p as UserPreferencesPayload;

describe('mood placement resolver', () => {
  it('defaults both blocks to the drawer when nothing is set', () => {
    expect(moodQuestionPlacement(prefs({}))).toBe('accordion');
    expect(moodPositivesPlacement(prefs({}))).toBe('accordion');
  });

  it('maps the legacy moodOfferDailyQuestion flag onto the question placement', () => {
    expect(moodQuestionPlacement(prefs({ moodOfferDailyQuestion: false }))).toBe('off');
    expect(moodQuestionPlacement(prefs({ moodOfferDailyQuestion: true }))).toBe('accordion');
  });

  it('lets an explicit placement win over the legacy flag', () => {
    expect(
      moodQuestionPlacement(prefs({ moodQuestionPlacement: 'form', moodOfferDailyQuestion: false })),
    ).toBe('form');
    expect(moodPositivesPlacement(prefs({ moodPositivesPlacement: 'off' }))).toBe('off');
  });
});

describe('moodEntryOrder', () => {
  it('leads with the chosen block, others in canonical order', () => {
    expect(moodEntryOrder('positives')).toEqual(['positives', 'comment', 'question']);
    expect(moodEntryOrder('comment')).toEqual(['comment', 'positives', 'question']);
    expect(moodEntryOrder('question')).toEqual(['question', 'positives', 'comment']);
  });
});
