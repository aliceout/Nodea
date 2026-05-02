import { useEffect, useMemo, useState } from 'react';
import type { ReviewPayload } from '@nodea/shared';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import {
  QUESTION_STEPS,
  STEPS,
  GROUP_LABELS,
  getByPath,
  questionPosition,
  setByPath,
  type Step,
} from '../config/steps';
import { useDraft } from '../hooks/useDraft';
import { useReview, type ReviewRecord } from '../hooks/useReview';
import SectionForm from '../components/SectionForm';
import StepNav from '../components/StepNav';

interface WizardProps {
  year: number;
  existing?: ReviewRecord;
  /** When true, auto-load the encrypted localStorage draft for
   *  this year without prompting. Set this when the user clicked
   *  « Reprendre » on the list view — they've already validated
   *  the intent, so a confirm() dialog would be redundant. */
  resume?: boolean;
  onDone(): void;
  onCancel(): void;
}

function emptyPayload(year: number): ReviewPayload {
  return {
    year,
    last_year: {},
    next_year: {},
    closing: {},
    // `updated_at` is bumped to now() by useReview's create/update
    // wrappers on every save ; this empty placeholder is just to
    // satisfy the Zod-inferred shape at construction time.
    updated_at: '',
  };
}

function isFilled(step: Step, value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((v) => String(v).trim().length > 0);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) =>
      isFilled(step, v),
    );
  }
  return false;
}

export default function ReviewWizard({
  year,
  existing,
  resume,
  onDone,
  onCancel,
}: WizardProps) {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { createReview, updateReview } = useReview();
  const {
    hydrated,
    hydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useDraft(year);

  const [payload, setPayload] = useState<ReviewPayload>(
    () => existing?.payload ?? emptyPayload(year),
  );
  const [hydrationOffered, setHydrationOffered] = useState(false);
  const [index, setIndex] = useState(0);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const step = STEPS[index]!;

  // Offer to resume an encrypted draft, only once on load.
  // The `resume` flag (set when arriving from « Reprendre » on the
  // list view) skips the confirm prompt — the user has already
  // told us they want their draft back.
  useEffect(() => {
    if (hydrating || hydrationOffered || existing) return;
    setHydrationOffered(true);
    if (!hydrated) return;
    if (
      resume ||
      window.confirm(t('review.wizard.resumePrompt', { values: { year } }))
    ) {
      setPayload(hydrated);
    } else {
      clearDraft();
    }
  }, [hydrating, hydrationOffered, hydrated, existing, resume, year, clearDraft, t]);

  // Auto-save on every payload change (skip the initial empty state).
  useEffect(() => {
    if (existing) return;
    saveDraft(payload);
  }, [payload, saveDraft, existing]);

  const completed = useMemo(() => {
    const set = new Set<number>();
    STEPS.forEach((s, i) => {
      // Intro steps don't persist anything — treat them as always
      // complete so the StepNav rail doesn't paint them as missing.
      if (s.kind === 'intro') {
        set.add(i);
        return;
      }
      if (
        isFilled(
          s,
          getByPath(payload as unknown as Record<string, unknown>, s.path),
        )
      ) {
        set.add(i);
      }
    });
    return set;
  }, [payload]);

  function onChangeValue(next: unknown): void {
    setPayload(
      (prev) =>
        setByPath(
          prev as unknown as Record<string, unknown>,
          step.path,
          next,
        ) as unknown as ReviewPayload,
    );
  }

  function goto(nextIdx: number): void {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, nextIdx));
    setIndex(clamped);
  }

  async function submit(): Promise<void> {
    setFinalError(null);
    setSubmitting(true);
    try {
      if (existing) {
        await updateReview(existing.id, payload);
      } else {
        await createReview(payload);
        clearDraft();
      }
      onDone();
    } catch (err) {
      setFinalError(
        err instanceof Error ? err.message : t('review.errors.saveFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const value = getByPath(
    payload as unknown as Record<string, unknown>,
    step.path,
  );
  const isLast = index === STEPS.length - 1;
  const qIndex = questionPosition(step);
  const topbarLabel =
    qIndex < 0
      ? t('review.topbar.wizardLabelIntro', { values: { year: payload.year } })
      : t('review.topbar.wizardLabelStep', {
          values: {
            year: payload.year,
            position: qIndex + 1,
            total: QUESTION_STEPS.length,
          },
        });

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={topbarLabel}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('review.wizard.quit')}
          </Button>
        </Topbar>
      }
    >
      {/* Header (eyebrow + title + StepNav + subtitle) is sticky
          right under the 52 px Topbar so the question + progress
          stay anchored while the form scrolls. Negative margins
          extend the bg-bg pane to the parent's padding edges so
          form content doesn't bleed through on either side when
          the user scrolls. */}
      <div className="sticky top-[52px] z-10 -mx-6 -mt-7 bg-bg px-6 pt-7 pb-5 sm:-mx-9 sm:px-9">
        <div className="mx-auto max-w-3xl">
          <header className="mb-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              {t('review.wizard.eyebrow', {
                values: { year: payload.year, group: GROUP_LABELS[step.group] },
              })}
            </p>
            <h1 className="mt-2 text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
              {step.title}
            </h1>
          </header>

          <StepNav index={index} onJump={goto} completed={completed} />

          {step.subtitle ? (
            <p className="mt-4 text-[13.5px] leading-[1.5] text-ink-soft">
              {step.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-3xl pt-7">
        <section>
          <SectionForm step={step} value={value} onChange={onChangeValue} />
        </section>

        {finalError ? (
          <InlineAlert className="mt-5">{finalError}</InlineAlert>
        ) : null}

        <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-hair pt-5">
          {index === 0 ? (
            <Button variant="neutral" size="sm" onClick={onCancel}>
              {t('review.wizard.quit')}
            </Button>
          ) : (
            <Button
              variant="neutral"
              size="sm"
              onClick={() => goto(index - 1)}
            >
              {t('review.wizard.back')}
            </Button>
          )}
          <span className="flex-1" />
          {!isLast ? (
            <>
              {step.kind !== 'intro' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goto(index + 1)}
                >
                  {t('review.wizard.skip')}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                onClick={() => goto(index + 1)}
              >
                {step.kind === 'intro'
                  ? t('review.wizard.start')
                  : t('review.wizard.next')}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting
                ? t('review.wizard.submitting')
                : existing
                  ? t('review.wizard.update')
                  : t('review.wizard.finalize')}
            </Button>
          )}
        </footer>
      </div>
    </ModuleShell>
  );
}
