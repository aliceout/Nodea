import { useNodeaStore } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import {
  STEPS,
  GROUP_LABELS,
  getByPath,
  type MixedFieldType,
  type Step,
} from '../config/steps';
import type { ReviewRecord } from '../hooks/useReview';

interface ReaderProps {
  record: ReviewRecord;
  onBack(): void;
}

const FIELD_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.04em] text-muted';
const PARA_CLASS =
  'whitespace-pre-wrap text-[15px] leading-[1.65] text-ink';
const LIST_CLASS =
  'list-disc space-y-1 pl-5 text-[15px] leading-[1.65] text-ink';

function renderValue(step: Step, value: unknown): React.ReactNode {
  if (step.kind === 'intro') {
    // The welcome screen never persists anything — skip it in the
    // reader so the article reads as the booklet's payload only.
    return null;
  }

  if (value == null) return null;

  if (step.kind === 'textarea') {
    const s = String(value).trim();
    if (!s) return null;
    return <p className={PARA_CLASS}>{s}</p>;
  }

  if (step.kind === 'string_list') {
    const arr = (Array.isArray(value) ? value : []) as string[];
    const clean = arr.map((v) => v.trim()).filter(Boolean);
    if (clean.length === 0) return null;
    return (
      <ul className={LIST_CLASS}>
        {clean.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }

  if (step.kind === 'keyed_text') {
    const obj = (value ?? {}) as Record<string, string>;
    const items = step.fields
      .map((f) => ({ f, v: String(obj[f.key] ?? '').trim() }))
      .filter((x) => x.v.length > 0);
    if (items.length === 0) return null;
    return (
      <dl className="space-y-3">
        {items.map(({ f, v }) => (
          <div key={f.key}>
            <dt className={FIELD_LABEL_CLASS}>{f.label}</dt>
            <dd className={`mt-1 ${PARA_CLASS}`}>{v}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (step.kind === 'keyed_list') {
    const obj = (value ?? {}) as Record<string, string[]>;
    const items = step.fields
      .map((f) => ({
        f,
        list: (Array.isArray(obj[f.key]) ? obj[f.key]! : [])
          .map((s) => String(s).trim())
          .filter(Boolean),
      }))
      .filter((x) => x.list.length > 0);
    if (items.length === 0) return null;
    return (
      <div className="space-y-4">
        {items.map(({ f, list }) => (
          <div key={f.key}>
            <p className={FIELD_LABEL_CLASS}>{f.label}</p>
            <ul className={`mt-1 ${LIST_CLASS}`}>
              {list.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (step.kind === 'keyed_mixed') {
    const obj = (value ?? {}) as Record<string, unknown>;
    const items = step.fields
      .map((f) => ({ f, rendered: renderMixed(f.type, obj[f.key]) }))
      .filter((x) => x.rendered !== null);
    if (items.length === 0) return null;
    return (
      <div className="space-y-4">
        {items.map(({ f, rendered }) => (
          <div key={f.key}>
            <p className={FIELD_LABEL_CLASS}>{f.label}</p>
            <div className="mt-1">{rendered}</div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function renderMixed(type: MixedFieldType, value: unknown): React.ReactNode {
  if (type === 'list') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const clean = arr.map((v) => String(v).trim()).filter(Boolean);
    if (clean.length === 0) return null;
    return (
      <ul className={LIST_CLASS}>
        {clean.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }
  // text / textarea / date — all render as a single paragraph
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return <p className={PARA_CLASS}>{s}</p>;
}

export default function ReviewReader({ record, onBack }: ReaderProps) {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const payload = record.payload as Record<string, unknown> & { year: number };
  const byGroup = new Map<Step['group'], Step[]>();
  for (const step of STEPS) {
    if (step.kind === 'intro') continue;
    if (!byGroup.has(step.group)) byGroup.set(step.group, []);
    byGroup.get(step.group)!.push(step);
  }

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Review · Bilan ${payload.year}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Retour
          </Button>
        </Topbar>
      }
    >
      <article className="mx-auto max-w-2xl">
        <header className="mb-10 space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
            YearCompass
          </p>
          <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.01em] text-ink">
            Bilan {payload.year}
          </h1>
        </header>

        {Array.from(byGroup.entries()).map(([group, steps]) => {
          const sections = steps
            .map((s) => ({ s, value: getByPath(payload, s.path) }))
            .filter((x) => renderValue(x.s, x.value) !== null);
          if (sections.length === 0) return null;

          return (
            <section key={group} className="mb-10 space-y-7 last:mb-0">
              <h2 className="border-b border-hair pb-2 font-serif text-[26px] tracking-[-0.005em] text-ink">
                {GROUP_LABELS[group]}
              </h2>
              {sections.map(({ s, value }) => (
                <div key={s.id} className="space-y-3">
                  <h3 className="font-serif text-[20px] tracking-[-0.005em] text-ink">
                    {s.title}
                  </h3>
                  {s.subtitle ? (
                    <p className="text-[13px] italic text-muted">{s.subtitle}</p>
                  ) : null}
                  <div>{renderValue(s, value)}</div>
                </div>
              ))}
            </section>
          );
        })}
      </article>
    </ModuleShell>
  );
}
