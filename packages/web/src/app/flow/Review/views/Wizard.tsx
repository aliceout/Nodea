import { useEffect, useMemo, useState } from 'react';
import type { ReviewPayload } from '@nodea/shared';
import {
  STEPS,
  GROUP_LABELS,
  getByPath,
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
  onDone(): void;
  onCancel(): void;
}

function emptyPayload(year: number): ReviewPayload {
  return {
    year,
    last_year: {},
    next_year: {},
    closing: {},
  };
}

function isFilled(step: Step, value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((v) => String(v).trim().length > 0);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => isFilled(step, v));
  }
  return false;
}

export default function ReviewWizard({ year, existing, onDone, onCancel }: WizardProps) {
  const { createReview, updateReview } = useReview();
  const { hydrated, hydrating, save: saveDraft, clear: clearDraft, saving, lastSavedAt } = useDraft(year);

  const [payload, setPayload] = useState<ReviewPayload>(() =>
    existing?.payload ?? emptyPayload(year),
  );
  const [hydrationOffered, setHydrationOffered] = useState(false);
  const [index, setIndex] = useState(0);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const step = STEPS[index]!;

  // Offer to resume an encrypted draft, only once on load.
  useEffect(() => {
    if (hydrating || hydrationOffered || existing) return;
    setHydrationOffered(true);
    if (hydrated) {
      if (window.confirm(`Un brouillon chiffré existe pour ${year}. Le reprendre ?`)) {
        setPayload(hydrated);
      } else {
        clearDraft();
      }
    }
  }, [hydrating, hydrationOffered, hydrated, existing, year, clearDraft]);

  // Auto-save on every payload change (skip the initial empty state).
  useEffect(() => {
    if (existing) return; // editing an existing entry bypasses the draft cache
    saveDraft(payload);
  }, [payload, saveDraft, existing]);

  const completed = useMemo(() => {
    const set = new Set<number>();
    STEPS.forEach((s, i) => {
      if (isFilled(s, getByPath(payload as unknown as Record<string, unknown>, s.path))) {
        set.add(i);
      }
    });
    return set;
  }, [payload]);

  function onChangeValue(next: unknown): void {
    setPayload((prev) => setByPath(prev as unknown as Record<string, unknown>, step.path, next) as unknown as ReviewPayload);
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
      setFinalError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

  const value = getByPath(payload as unknown as Record<string, unknown>, step.path);
  const isLast = index === STEPS.length - 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <header className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">
              Bilan {payload.year} · {GROUP_LABELS[step.group]}
            </p>
            <h1 className="text-2xl font-bold">{step.title}</h1>
            {step.subtitle ? (
              <p className="mt-1 text-sm opacity-80">{step.subtitle}</p>
            ) : null}
          </div>
          <div className="text-right text-xs opacity-60">
            {saving ? 'Sauvegarde…' : lastSavedAt ? 'Brouillon chiffré ✓' : null}
          </div>
        </div>

        <StepNav index={index} onJump={goto} completed={completed} />
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <SectionForm step={step} value={value} onChange={onChangeValue} />
      </section>

      {finalError ? <p className="text-sm text-red-600">{finalError}</p> : null}

      <footer className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Quitter
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          ← Précédent
        </button>
        {!isLast ? (
          <>
            <button
              type="button"
              onClick={() => goto(index + 1)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Sauter
            </button>
            <button
              type="button"
              onClick={() => goto(index + 1)}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Suivant →
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {submitting
              ? 'Enregistrement…'
              : existing
                ? 'Mettre à jour le bilan'
                : 'Finaliser le bilan'}
          </button>
        )}
      </footer>
    </div>
  );
}
