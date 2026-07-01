/**
 * Cycle — menstrual-cycle tracking (spec `docs/Modules/Cycle.md`).
 *
 * P1 surface : a month calendar (period days + predicted band) with a
 * click-to-log day form, and a next-period estimate that degrades to an
 * honest « not enough data / irregular » rather than a confident-but-
 * wrong date. Ring + stacked-cycles views and the opt-in fertility
 * block come in P2/P3. Single-file orchestration — well under the split
 * threshold, so no context/hooks scaffolding (YAGNI until it grows).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CyclePayload } from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { cycleClient } from '@/core/api/modules/cycle';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import CycleCalendar from './components/CycleCalendar';
import CycleDayForm from './components/CycleDayForm';
import { computeCycle } from './lib/cycle-model';

type Rec = DecryptedRecord<CyclePayload>;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function LegendRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 rounded-full ${swatch}`} />
      <span>{label}</span>
    </div>
  );
}

export default function CyclePage() {
  const { t, language } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const ctx = useModuleClient('cycle');
  const today = useMemo(todayIso, []);
  const [records, setRecords] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!ctx) return;
    cycleClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [ctx]);
  useEffect(reload, [reload]);

  const stats = useMemo(
    () =>
      computeCycle(
        records.map((r) => ({
          date: r.payload.date,
          ...(r.payload.flow ? { flow: r.payload.flow } : {}),
        })),
        today,
      ),
    [records, today],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, Rec>();
    for (const r of records) m.set(r.payload.date, r);
    return m;
  }, [records]);

  const nextLabel =
    stats.next &&
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(
      new Date(`${stats.next.date}T12:00:00`),
    );

  const side =
    selected && ctx ? (
      <CycleDayForm
        ctx={ctx}
        date={selected}
        existing={byDate.get(selected) ?? null}
        onSaved={() => {
          setSelected(null);
          reload();
        }}
        onCancel={() => setSelected(null)}
      />
    ) : (
      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-md)] border border-hair bg-bg p-4">
          <div className="text-[12px] font-medium text-muted">
            {t('cycle.estimate.title')}
          </div>
          {stats.status === 'ok' && stats.next ? (
            <>
              <div className="mt-1 text-lg font-semibold capitalize text-ink">
                {nextLabel}
              </div>
              <div className="text-[12px] text-muted">
                {t('cycle.estimate.inDays', { values: { count: stats.next.daysUntil } })} ·{' '}
                {t('cycle.estimate.avg', { values: { days: stats.averageCycle ?? 0 } })}
              </div>
            </>
          ) : (
            <div className="mt-1 text-[13px] text-muted">
              {t(
                stats.status === 'irregular'
                  ? 'cycle.estimate.irregular'
                  : 'cycle.estimate.notEnough',
              )}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-snug text-muted-soft">
            {t('cycle.disclaimer')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-[12px] text-muted">
          <LegendRow swatch="bg-accent-strong" label={t('cycle.legend.period')} />
          <LegendRow
            swatch="border border-dashed border-accent"
            label={t('cycle.legend.predicted')}
          />
          <LegendRow swatch="ring-1 ring-accent" label={t('cycle.legend.today')} />
        </div>
      </div>
    );

  return (
    <ModuleShell
      topbar={
        <Topbar label={t('cycle.title')} onOpenMenu={() => setMobileMenuOpen(true)}>
          {!selected ? (
            <Button variant="primary" size="sm" onClick={() => setSelected(today)}>
              {t('cycle.logToday')}
            </Button>
          ) : null}
        </Topbar>
      }
      side={side}
    >
      {ctx ? (
        <CycleCalendar
          periodDays={stats.periodDays}
          predictedDays={stats.predictedDays}
          today={today}
          selected={selected}
          onSelectDay={setSelected}
          language={language}
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted">{t('cycle.notReady')}</p>
      )}
    </ModuleShell>
  );
}
