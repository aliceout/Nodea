import { useMemo, useState } from 'react';
import { MOOD_SCORE_VALUES, type MoodScore } from '@nodea/shared';

import { pickQuestion } from '@/app/flow/Mood/data/questions';
import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkTextarea from '@/ui/atoms/dirk/Textarea';
import SectionLabel from '@/ui/dirk/SectionLabel';

import Footer from '../components/Footer';
import { POSITIVE_PLACEHOLDERS } from '../lib/constants';
import { submitOnCmdEnter } from '../lib/format';
import { isMoodScoreString } from '../lib/guards';

interface MoodBodyProps {
  onClose: () => void;
}

/**
 * Mood entry body — three positives + a -2..+2 note score +
 * optional « question du jour » answer + optional free-form
 * comment. Mirrors the canonical `MoodPayloadSchema` ; emoji
 * is dropped on write but tolerated on read for legacy
 * payloads (preserved verbatim during edits).
 *
 * Edit vs create :
 *   - On edit, the original `date` is preserved (the user is
 *     amending content, not redating) and the « question du
 *     jour » stays the one already saved on the entry — the
 *     answer is paired with that specific prompt.
 *   - On create, today's local date is used and a random
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
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['mood']?.moduleUserId ?? null;
  const bumpMoodVersion = useNodeaStore((s) => s.bumpMoodVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'mood'
      ? s.composer.editing
      : null,
  );

  const initialScore = editing && isMoodScoreString(editing.payload.mood_score)
    ? (editing.payload.mood_score as MoodScore)
    : null;
  const initialPositives: [string, string, string] = editing
    ? [
        editing.payload.positive1 ?? '',
        editing.payload.positive2 ?? '',
        editing.payload.positive3 ?? '',
      ]
    : ['', '', ''];

  const [positives, setPositives] =
    useState<[string, string, string]>(initialPositives);
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
    if (!mainKey || !moduleUserId) {
      setError(t('mood.composer.errors.missingConfig'));
      return;
    }
    setSubmitting(true);
    try {
      let dateIso: string;
      if (editing) {
        dateIso = editing.payload.date;
      } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateIso = `${yyyy}-${mm}-${dd}`;
      }
      const trimmedAnswer = answer.trim();
      const payload = {
        date: dateIso,
        mood_score: score,
        mood_emoji: editing?.payload.mood_emoji ?? '',
        positive1: positives[0],
        positive2: positives[1],
        positive3: positives[2],
        comment,
        ...(trimmedAnswer ? { question, answer: trimmedAnswer } : {}),
      };
      if (editing) {
        await moodClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await moodClient.create(moduleUserId, mainKey, payload);
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
        <div className="space-y-2">
          <SectionLabel>{t('mood.composer.positivesHeading')}</SectionLabel>
          {[0, 1, 2].map((i) => (
            <DirkInput
              key={i}
              value={positives[i as 0 | 1 | 2]}
              onChange={(e) => setPositive(i as 0 | 1 | 2, e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder={POSITIVE_PLACEHOLDERS[i] ?? ''}
              autoFocus={i === 0}
            />
          ))}
        </div>

        <div>
          <SectionLabel>{t('mood.composer.scoreHeading')}</SectionLabel>
          <div className="grid grid-cols-5 gap-1.5">
            {MOOD_SCORE_VALUES.map((value) => {
              const selected = score === value;
              const numeric = Number(value);
              const tone =
                numeric > 0
                  ? selected
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg text-ink-soft border-hair hover:border-accent'
                  : numeric < 0
                    ? selected
                      ? 'bg-low text-white border-low'
                      : 'bg-bg text-ink-soft border-hair hover:border-low'
                    : selected
                      ? 'bg-bg-2 text-ink border-ink-soft'
                      : 'bg-bg text-ink-soft border-hair hover:border-ink-soft';
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  aria-pressed={selected}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-sm border px-2 py-1.5 text-[11px] transition-colors',
                    tone,
                  )}
                >
                  <span className="text-[14px] font-semibold tabular-nums">
                    {numeric > 0 ? `+${value}` : value}
                  </span>
                  <span className="text-[10px] tracking-[0.02em]">{t(`mood.scoreLabels.${value}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOptionalsOpen((v) => !v)}
          className="text-[12px] text-muted transition-colors hover:text-ink"
          aria-expanded={optionalsOpen}
        >
          {optionalsOpen ? t('mood.composer.optionalsCollapse') : t('mood.composer.optionalsExpand')}
        </button>

        {optionalsOpen ? (
          <div className="space-y-3 pt-1">
            <div>
              <p className="mb-1 text-[12px] text-muted">
                <span className="font-semibold tracking-[0.02em]">{t('mood.composer.questionLabel')}</span>
                <span className="font-serif italic text-ink-soft">
                  {question || '—'}
                </span>
              </p>
              <DirkTextarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
                placeholder={t('mood.composer.answerPlaceholder')}
                rows={2}
                minHeightPx={56}
              />
            </div>

            <div>
              <SectionLabel>{t('mood.composer.commentHeading')}</SectionLabel>
              <DirkTextarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
                placeholder={t('mood.composer.commentPlaceholder')}
                rows={3}
                minHeightPx={84}
              />
            </div>
          </div>
        ) : null}
      </div>
      <Footer
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        submitLabel={isEdit ? t('common.actions.update') : t('common.actions.save')}
        submittingLabel={isEdit ? t('mood.composer.submittingUpdate') : t('common.states.saving')}
      />
    </>
  );
}
