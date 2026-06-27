import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { AdminSourcesResponse, SourceHealth } from '@nodea/shared';

import { apiAdminSources } from '@/core/api/client';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

/**
 * Admin "Sources" tab — health check for every external metadata
 * provider used by the modules. Hits the server, which probes each
 * provider in parallel with a known-good ISBN, and reports:
 *
 *   - **configured** : env-side setup (e.g., Google Books needs an
 *     API key in `LIBRARY_GOOGLE_BOOKS_API_KEY`)
 *   - **online** : the provider's endpoint responded ok
 *   - **testFoundResults** : the probe query returned at least one
 *     record (catches the "online but mute" case where the API
 *     itself works but auth/quotas are silently dropping queries)
 *   - **responseMs** : round-trip latency
 *   - **error** : human-readable reason when something fails
 *
 * The probe runs once on tab open and on demand via "Re-tester".
 * Each call hits up to 5 providers, bounded by their fetch
 * timeouts (~6–8s), so the worst-case wait is around 8s.
 */
export default function SourcesPanel() {
  const { t, language } = useI18n();
  const [data, setData] = useState<AdminSourcesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probe(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await apiAdminSources();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.sources.unknownError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void probe();
    // Mount-once probe. `probe` now closes over `t`, so listing it would
    // re-hit the sources API on every render that changes the t identity —
    // not wanted; the « Re-tester » button covers manual refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted">
          {data
            ? t('admin.sources.lastChecked', {
                values: { time: new Date(data.meta.generatedAt).toLocaleTimeString(language) },
              })
            : t('admin.sources.awaitingFirstCheck')}
        </p>
        <Button
          variant="neutral"
          size="sm"
          onClick={probe}
          disabled={loading}
        >
          <ArrowPathIcon
            className={cn('h-3.5 w-3.5', loading ? 'animate-spin' : '')}
            aria-hidden="true"
          />
          {loading ? t('common.states.verifying') : t('admin.sources.retest')}
        </Button>
      </div>

      {error ? <InlineAlert className="mb-4">{error}</InlineAlert> : null}

      {data ? (
        <div className="divide-y divide-hair">
          {Object.entries(groupByModule(data.data)).map(([moduleName, sources]) => (
            <ModuleBlock key={moduleName} moduleName={moduleName} sources={sources} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Group the flat `data` array (uniform `{ data, meta }` envelope from
 * the API) by `module`, preserving the order the server returned. Lets
 * the UI keep its per-module sections without the server having to
 * nest the response.
 */
function groupByModule(sources: SourceHealth[]): Record<string, SourceHealth[]> {
  const grouped: Record<string, SourceHealth[]> = {};
  for (const source of sources) {
    const bucket = grouped[source.module] ?? [];
    bucket.push(source);
    grouped[source.module] = bucket;
  }
  return grouped;
}

interface ModuleBlockProps {
  moduleName: string;
  sources: SourceHealth[];
}

function ModuleBlock({ moduleName, sources }: ModuleBlockProps) {
  const { t } = useI18n();
  // Known modules carry a curated label; unknown ones fall back to
  // the raw server-provided module id.
  const label = t(`admin.sources.moduleLabels.${moduleName}`, { defaultValue: moduleName });
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{label}</h3>
      <ul>
        {sources.map((s) => (
          <SourceRow key={s.name} source={s} />
        ))}
      </ul>
    </section>
  );
}

function SourceRow({ source }: { source: SourceHealth }) {
  const { t } = useI18n();
  const status = computeStatus(source);
  return (
    <li className="border-b border-hair py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-ink">
          <span className="truncate">{source.label}</span>
          {source.needsKey ? (
            <span className="shrink-0 rounded bg-bg-2 px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">
              {t('admin.sources.status.keyRequired')}
            </span>
          ) : null}
        </p>
        <span className="shrink-0 text-[11.5px] tabular-nums text-muted">
          {source.responseMs !== null
            ? t('admin.sources.responseMs', { values: { ms: source.responseMs } })
            : '—'}
        </span>
        <StatusBadge tone={status.tone} label={t(status.labelKey)} />
      </div>
      {source.error ? (
        <p className="mt-1 text-[11.5px] text-danger">{source.error}</p>
      ) : null}
    </li>
  );
}

interface StatusInfo {
  /** i18n key for the status label, resolved at render. */
  labelKey: string;
  tone: 'ok' | 'fail' | 'idle';
}

/**
 * Online = green, full stop. Whether the test query returned a
 * record or not is logged server-side for diagnostic but doesn't
 * affect the UI color: an admin doesn't care about "the probe
 * found 0 results", they care about "is this source reachable".
 */
function computeStatus(s: SourceHealth): StatusInfo {
  if (!s.configured) {
    return { tone: 'idle', labelKey: 'admin.sources.status.notConfigured' };
  }
  if (!s.online) {
    return { tone: 'fail', labelKey: 'admin.sources.status.offline' };
  }
  return { tone: 'ok', labelKey: 'admin.sources.status.online' };
}

function StatusBadge({ tone, label }: { tone: StatusInfo['tone']; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold tracking-[0.02em]',
        tone === 'ok' && 'bg-accent-strong text-white',
        tone === 'fail' && 'bg-danger/10 text-danger',
        tone === 'idle' && 'border border-hair bg-bg text-muted',
      )}
    >
      {label}
    </span>
  );
}
