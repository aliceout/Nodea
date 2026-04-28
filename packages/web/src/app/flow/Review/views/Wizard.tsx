import { useEffect, useMemo, useState } from 'react';
import type { ReviewPayload } from '@nodea/shared';
import { useNodeaStore } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import ModuleShell from '@/ui/dirk/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
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
    return Object.values(value as Record<string, unknown>).some((v) =>
      isFilled(step, v),
    );
  }
  return false;
}

export default function ReviewWizard({
  year,
  existing,
  onDone,
  onCancel,
}: WizardProps) {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { createReview, updateReview } = useReview();
  const {
    hydrated,
    hydrating,
    save: saveDraft,
    clear: clearDraft,
    saving,
    lastSavedAt,
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
        err instanceof Error ? err.message : "Échec de l'enregistrement.",
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
  const draftStatus = saving
    ? 'Sauvegarde…'
    : lastSavedAt
      ? 'Brouillon chiffré ✓'
      : null;

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Review · Bilan ${payload.year} · étape ${index + 1}/${STEPS.length}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Quitter
          </Button>
        </Topbar>
      }
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              Bilan {payload.year} · {GROUP_LABELS[step.group]}
            </p>
            {draftStatus ? (
              <span className="text-[11px] text-muted">{draftStatus}</span>
            ) : null}
          </div>
          <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            {step.title}
          </h1>
        </header>

        <StepNav index={index} onJump={goto} completed={completed} />

        {step.subtitle ? (
          <p className="mt-5 text-[14px] leading-[1.55] text-ink-soft">
            {step.subtitle}
          </p>
        ) : null}

        <section className="mt-7">
          <SectionForm step={step} value={value} onChange={onChangeValue} />
        </section>

        {finalError ? (
          <InlineAlert className="mt-5">{finalError}</InlineAlert>
        ) : null}

        <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-hair pt-5">
          <Button
            variant="neutral"
            size="sm"
            onClick={() => goto(index - 1)}
            disabled={index === 0}
          >
            ← Précédent
          </Button>
          <span className="flex-1" />
          {!isLast ? (
            <>
              {step.kind !== 'intro' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goto(index + 1)}
                >
                  Sauter
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                onClick={() => goto(index + 1)}
              >
                {step.kind === 'intro' ? 'Commencer →' : 'Suivant →'}
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
                ? 'Enregistrement…'
                : existing
                  ? 'Mettre à jour le bilan'
                  : 'Finaliser le bilan'}
            </Button>
          )}
        </footer>
      </div>
    </ModuleShell>
  );
}
