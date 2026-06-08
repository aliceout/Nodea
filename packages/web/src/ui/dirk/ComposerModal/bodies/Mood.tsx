import { useMemo, useState } from 'react';
import type { MoodScore } from '@nodea/shared';

import { pickQuestion } from '@/app/flow/Mood/data/questions';
import { moodClient } from '@/core/api/modules/mood';
import { toIsoDate } from '@/core/i18n/date-format';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import DateField from '@/ui/atoms/dirk/DateField';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import Footer from '../components/Footer';
import { isMoodScoreString } from '../lib/guards';
import OptionalsSection from './mood/OptionalsSection';
import PositivesSection from './mood/PositivesSection';
import ScoreSection from './mood/ScoreSection';

interface MoodBodyProps {
  onClose: () => void;
}

/**
 * Mood entry orchestrator — assembles the structured form (date
 * + 3 positives + −2..+2 score + optional « question du jour »
 * answer + optional free comment) and wires the save call.
 * Sub-sections live under `bodies/mood/` so each block stays
 * small enough to read end-to-end. Mirrors the canonical
 * `MoodPayloadSchema` ; legacy `moodEmoji` is preserved on
 * read for back-compat but dropped on write.
 *
 * Edit vs create :
 *   - On edit, the original date pre-fills the date picker (but
 *     the user can change it — there's no DB or guard
 *     uniqueness on `(user, date)`, so two entries the same day
 *     are tolerated). The « question du jour » stays the one
 *     already saved on the entry — the answer is paired with
 *     that specific prompt.
 *   - On create, today's local date is the default and a random
 *     question is picked once at mount (`useMemo` keyed off
 *     `editing` so it stays stable while the user types).
 *
 * The optional question/answer pair only persists when the
 * answer is non-empty — keeps the schema's optional fields
 * genuinely optional rather than always carrying the question
 * text with an empty answer.
 */
export default function MoodBody({ onClose }: MoodBodyProps) {
  const { t, language } = useI18n();
  const ctx = useModuleClient('mood');
  const bumpMoodVersion = useNodeaStore((s) => s.bumpMoodVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'mood'
      ? s.composer.editing
      : null,
  );

  const initialScore =
    editing && isMoodScoreString(editing.payload.moodScore)
      ? (editing.payload.moodScore as MoodScore)
      : null;
  const initialPositives: [string, string, string] = editing
    ? [
        editing.payload.positive1 ?? '',
        editing.payload.positive2 ?? '',
        editing.payload.positive3 ?? '',
      ]
    : ['', '', ''];
  const initialDate = editing?.payload.date ?? toIsoDate(new Date());

  const [date, setDate] = useState(initialDate);
  const [positives, setPositives] = useState(initialPositives);
  const [score, setScore] = useState<MoodScore | null>(initialScore);
  const [answer, setAnswer] = useState(editing?.payload.answer ?? '');
  const [comment, setComment] = useState(editing?.payload.comment ?? '');
  const [optionalsOpen, setOptionalsOpen] = useState(
    Boolean(editing && (editing.payload.answer || editing.payload.comment)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing !== null;

  const question = useMemo<string>(() => {
    if (editing) return editing.payload.question ?? '';
    return pickQuestion(language);
  }, [editing, language]);

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
        moodEmoji: editing?.payload.moodEmoji ?? '',
        positive1: positives[0],
        positive2: positives[1],
        positive3: positives[2],
        comment,
        ...(trimmedAnswer ? { question, answer: trimmedAnswer } : {}),
      };
      if (editing) {
        await moodClient.update(ctx.moduleUserId, ctx.mainKey, editing.id, payload);
      } else {
        await moodClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      }
      bumpMoodVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('mood.composer.errors.saveFailed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-3.5 px-[22px] pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="mood-date"
            className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted"
          >
            {t('mood.composer.dateHeading')}
          </label>
          <DateField
            id="mood-date"
            inline
            value={date}
            onChange={setDate}
            max={toIsoDate(new Date())}
            className="w-auto"
          />
        </div>

        <PositivesSection
          values={positives}
          onChange={setPositive}
          onSubmit={handleSave}
        />

        <ScoreSection value={score} onChange={setScore} />

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
      <Footer
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        submitLabel={isEdit ? t('common.actions.update') : t('common.actions.save')}
        submittingLabel={
          isEdit ? t('mood.composer.submittingUpdate') : t('common.states.saving')
        }
      />
    </>
  );
}
