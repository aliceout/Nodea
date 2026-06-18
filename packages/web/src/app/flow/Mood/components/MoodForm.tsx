import { useState } from 'react';
import type { MoodScore } from '@nodea/shared';

import { pickQuestion } from '@/app/flow/Mood/data/questions';
import { moodClient } from '@/core/api/modules/mood';
import { toIsoDate } from '@/core/i18n/date-format';
import { useModuleClient } from '@/core/modules/use-module-client';
import Button from '@/ui/atoms/dirk/Button';
import DateField from '@/ui/atoms/dirk/DateField';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { MODULE_FORM_CARD } from '@/ui/dirk/forms/constants';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import { useMoodActions } from '../context';

import OptionalsSection from './form-sections/OptionalsSection';
import PositivesSection from './form-sections/PositivesSection';
import ScoreSection from './form-sections/ScoreSection';

import type { MoodEntry } from '../lib/types';

interface MoodFormProps {
  /** When set, the form edits this entry instead of creating one. */
  initial?: MoodEntry;
  /** Close the form (cancel, or after a successful submit). */
  onClose: () => void;
}

/**
 * Mood entry form — inline composer rendered by `PrimaryColumn`
 * above the entries list, mirroring the HRT `AdminLogForm`
 * posture : a bordered card with the form fields grid + a
 * cancel/save row, no chrome that pulls the user away from the
 * page.
 *
 * Decomposed across three sub-sections (`PositivesSection`,
 * `ScoreSection`, `OptionalsSection`) living next door in
 * `./form-sections/`.
 *
 * Save / update / error handling : `upsertRecord` splices the saved
 * record into the in-memory list on success (no full-collection
 * refetch — audit 2026-06 passe 2), `onClose` returns the user to the
 * list, and the in-component error feedback shows the friendly
 * message when validation or the network call fails.
 */
export default function MoodForm({ initial, onClose }: MoodFormProps) {
  const { t, language } = useI18n();
  const ctx = useModuleClient('mood');
  const { upsertRecord } = useMoodActions();

  // Initial values come from `initial` on edit (the entry being
  // re-opened from the list) or sensible defaults on create.
  const initialScore: MoodScore | null = initial ? initial.score : null;
  const initialPositives: [string, string, string] = initial
    ? [
        initial.positives[0] ?? '',
        initial.positives[1] ?? '',
        initial.positives[2] ?? '',
      ]
    : ['', '', ''];
  const initialDate = initial?.dateIso ?? toIsoDate(new Date());

  const [date, setDate] = useState(initialDate);
  const [positives, setPositives] = useState(initialPositives);
  const [score, setScore] = useState<MoodScore | null>(initialScore);
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [optionalsOpen, setOptionalsOpen] = useState(
    Boolean(initial && (initial.answer || initial.comment)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = initial !== undefined;

  // Pin the « question du jour » once at mount on create so it
  // doesn't shuffle while the user types. `useState` initialiser
  // (not `useMemo([language])`) — a language switch mid-typing
  // used to draw a *different* random question, orphaning the
  // answer already typed under the previous one (audit 2026-06).
  // On edit, the original question stays paired with the saved
  // answer.
  const [question] = useState<string>(() => {
    if (initial?.question) return initial.question;
    if (initial) return '';
    return pickQuestion(language);
  });

  function setPositive(idx: 0 | 1 | 2, value: string): void {
    setPositives((prev) => {
      const next: [string, string, string] = [prev[0], prev[1], prev[2]];
      next[idx] = value;
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    if (!score) {
      setError(t('mood.composer.errors.scoreRequired'));
      return;
    }
    if (!ctx) {
      setError(t('mood.composer.errors.missingConfig'));
      return;
    }
    setSubmitting(true);
    try {
      const trimmedAnswer = answer.trim();
      const payload = {
        date,
        moodScore: score,
        moodEmoji: '',
        positive1: positives[0],
        positive2: positives[1],
        positive3: positives[2],
        comment,
        ...(trimmedAnswer ? { question, answer: trimmedAnswer } : {}),
      };
      const record = initial
        ? await moodClient.update(ctx.moduleUserId, ctx.mainKey, initial.id, payload)
        : await moodClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      upsertRecord(record);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('mood.composer.errors.saveFailed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className={MODULE_FORM_CARD}
      noValidate
    >
      <div className="space-y-3.5">
        {/* Top row : date on the left, score buttons on the right.
            The −2..+2 picker is the form's single mandatory non-
            text input ; pinning it next to the date packs both
            « quick capture » signals (when + how) into the same
            visual band so the user resolves them in one glance.
            Below `sm` the two stack so the score buttons keep their
            5-column grid without crushing. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-4">
          <div>
            <SectionLabel>{t('mood.composer.dateHeading')}</SectionLabel>
            <DateField
              id="mood-date"
              inline
              value={date}
              onChange={setDate}
              max={toIsoDate(new Date())}
              className="w-auto"
            />
          </div>

          <ScoreSection
            value={score}
            onChange={setScore}
            // The form-level alert is about the score while no score
            // is picked (« Choisis une note du jour. ») — point the
            // group at it ; once a score exists the error concerns
            // the save path, not this group.
            ariaDescribedBy={
              error && score === null ? 'mood-form-error' : undefined
            }
          />
        </div>

        <PositivesSection
          values={positives}
          onChange={setPositive}
          onSubmit={handleSave}
        />

        <button
          type="button"
          onClick={() => setOptionalsOpen((v) => !v)}
          className="text-[12px] text-muted transition-colors hover:text-ink"
          aria-expanded={optionalsOpen}
        >
          {optionalsOpen
            ? t('mood.composer.optionalsCollapse')
            : t('mood.composer.optionalsExpand')}
        </button>

        {optionalsOpen ? (
          <OptionalsSection
            question={question}
            answer={answer}
            comment={comment}
            onAnswerChange={setAnswer}
            onCommentChange={setComment}
            onSubmit={handleSave}
          />
        ) : null}
      </div>

      {error ? (
        <p id="mood-form-error" role="alert" className="mt-3 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="neutral"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          {t('common.actions.cancel', { defaultValue: 'Annuler' })}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
        >
          {submitting
            ? isEdit
              ? t('mood.composer.submittingUpdate')
              : t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
