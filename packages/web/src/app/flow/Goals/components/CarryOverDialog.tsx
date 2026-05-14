import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import { Modal } from '@/ui/atoms/layout/Modal';

import { useGoalsActions, useGoalsData } from '../context';

/**
 * Modal that bulk-bumps unfinished goals from one year onto another.
 * Default mapping is « previous year → current year » since end-of-
 * year is when this matters most, but both fields are editable.
 *
 * Affected = goals whose date starts with the source year AND whose
 * status is open or wip. `done` goals stay where they are (a
 * completed goal is bound to the year it was achieved). The user
 * sees the count + a preview of the first few titles before
 * confirming, so a wrong year doesn't silently rewrite history.
 *
 * Self-conditional : reads `carryOverOpen` from `useGoalsActions()`
 * and returns `null` when closed, so the call site mounts this
 * unconditionally rather than wrapping in a ternary.
 */
export default function CarryOverDialog() {
  const { t, tn } = useI18n();
  const { entries } = useGoalsData();
  const { carryOverOpen, closeCarryOver, carryOver } = useGoalsActions();

  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(String(currentYear - 1));
  const [toYear, setToYear] = useState(String(currentYear));
  const [busy, setBusy] = useState(false);

  // Reset to the year-end defaults each time the dialog opens so a
  // previous session's tweak doesn't leak into the next.
  useEffect(() => {
    if (!carryOverOpen) return;
    setFromYear(String(currentYear - 1));
    setToYear(String(currentYear));
    setBusy(false);
  }, [carryOverOpen, currentYear]);

  const fromN = Number(fromYear);
  const toN = Number(toYear);
  const validRange =
    Number.isFinite(fromN) &&
    Number.isFinite(toN) &&
    fromN >= 1900 &&
    fromN <= 2200 &&
    toN >= 1900 &&
    toN <= 2200 &&
    toN !== fromN;

  const affected = useMemo(() => {
    if (!validRange) return [];
    const prefix = String(fromN);
    return entries.filter(
      (e) =>
        (e.status === 'open' || e.status === 'wip') &&
        (e.date.startsWith(`${prefix}-`) || e.date === prefix),
    );
  }, [entries, fromN, validRange]);

  async function confirm(): Promise<void> {
    if (!validRange || busy) return;
    setBusy(true);
    await carryOver(fromN, toN, [...affected]);
  }

  if (!carryOverOpen) return null;

  return (
    <Modal open onClose={closeCarryOver}>
      <div className="px-[22px] pt-3.5 pb-3">
        <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          {t('goals.carryOver.title')}
        </h2>
        <p className="mb-4 text-[12px] leading-[1.5] text-ink-soft">
          {t('goals.carryOver.intro')}
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              {t('goals.carryOver.fromLabel')}
            </span>
            <Input
              type="number"
              min={1900}
              max={2200}
              value={fromYear}
              align="center"
              onChange={(e) => setFromYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-24"
            />
          </label>
          <span className="pb-2 text-[12px] text-muted">→</span>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              {t('goals.carryOver.toLabel')}
            </span>
            <Input
              type="number"
              min={1900}
              max={2200}
              value={toYear}
              align="center"
              onChange={(e) => setToYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-24"
            />
          </label>
        </div>

        <div className="rounded-sm border border-hair bg-bg-2 p-3">
          {!validRange ? (
            <p className="text-[12px] italic text-muted">
              {t('goals.carryOver.invalidRange')}
            </p>
          ) : affected.length === 0 ? (
            <p className="text-[12px] italic text-muted">
              {t('goals.carryOver.noneEmpty', { values: { year: fromN } })}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-ink-soft">
                {tn('goals.carryOver.summary', affected.length, {
                  values: { fromYear: fromN, toYear: toN },
                })}
              </p>
              <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-[12px] text-ink">
                {affected.slice(0, 8).map((g) => (
                  <li key={g.id}>{g.title}</li>
                ))}
                {affected.length > 8 ? (
                  <li className="list-none italic text-muted">
                    {t('goals.carryOver.moreCount', {
                      values: { count: affected.length - 8 },
                    })}
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-hair bg-bg-2 px-3.5 py-2.5">
        <Button variant="neutral" size="sm" onClick={closeCarryOver} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void confirm()}
          disabled={!validRange || affected.length === 0 || busy}
        >
          {busy ? t('goals.carryOver.submitting') : t('goals.carryOver.submitCta')}
        </Button>
      </div>
    </Modal>
  );
}
