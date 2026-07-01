/**
 * Cycle — menstrual-cycle tracking (spec `docs/Modules/Cycle.md`).
 *
 * Orchestrates the page : three switchable views (calendar / ring /
 * stacked, via CycleViews) with the inline day composer above them
 * (CycleDayForm mounted through the shared InlinePanel) and an entries
 * list below, plus a next-period estimate in the side column. Reuses
 * the shared form chrome (MODULE_FORM_CARD / FormFooter / FormError)
 * and Tabs, same posture as Mood / Goals. Opt-in fertility block is P3.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CycleFlow, CyclePayload } from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { cycleClient } from '@/core/api/modules/cycle';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import CycleDayForm from './components/CycleDayForm';
import CycleEntriesList from './components/CycleEntriesList';
import CycleViews from './components/CycleViews';
import SideColumn from './components/SideColumn';
import { computeCycle } from './lib/cycle-model';

type Rec = DecryptedRecord<CyclePayload>;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function CyclePage() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const ctx = useModuleClient('cycle');
  const today = useMemo(todayIso, []);
  const [records, setRecords] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  const reload = useCallback(() => {
    if (!ctx) return;
    cycleClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((r) => {
        setRecords(r);
        setLoadError(null);
      })
      // Never swallow silently — an empty module and a broken fetch must
      // not look the same (a missing table 500 read as « no data »).
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : t('cycle.loadFailed'));
      });
  }, [ctx, t]);
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
  const flowByDate = useMemo(() => {
    const m = new Map<string, CycleFlow>();
    for (const r of records) if (r.payload.flow) m.set(r.payload.date, r.payload.flow);
    return m;
  }, [records]);
  const loggedDates = useMemo(
    () => new Set(records.map((r) => r.payload.date)),
    [records],
  );
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const r of records) set.add(Number(r.payload.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);
  // Jumping years drops a stale month so the entries list can't silently
  // empty (same guard as Mood).
  const changeYear = useCallback((y: number | null) => {
    setYear(y);
    setMonth(null);
  }, []);

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
      side={<SideColumn stats={stats} />}
    >
      {!ctx ? (
        <p className="p-6 text-center text-sm text-muted">{t('cycle.notReady')}</p>
      ) : loadError ? (
        <p className="p-6 text-center text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : (
        <section className="flex min-w-0 flex-col">
          <CycleViews
            stats={stats}
            flowByDate={flowByDate}
            loggedDates={loggedDates}
            today={today}
            selected={selected}
            onSelectDay={setSelected}
            formOpen={selected !== null}
            year={year}
            month={month}
            availableYears={availableYears}
            onYearChange={changeYear}
            onMonthChange={setMonth}
          />
          <InlinePanel open={selected !== null}>
            {selected ? (
              <CycleDayForm
                ctx={ctx}
                date={selected}
                initial={byDate.get(selected) ?? null}
                onSaved={(rec) => {
                  setRecords((prev) => {
                    const without = prev.filter((r) => r.payload.date !== selected);
                    return rec ? [rec, ...without] : without;
                  });
                  setSelected(null);
                }}
                onCancel={() => setSelected(null)}
              />
            ) : null}
          </InlinePanel>
          <CycleEntriesList
            records={records}
            year={year}
            month={month}
            onSelect={setSelected}
          />
        </section>
      )}
    </ModuleShell>
  );
}
