import { useState } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import { getProvider, PROVIDER_NAMES } from '@/core/cloud-backup/registry';
import { normaliseMnemonic } from '@/core/crypto/bip39';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import Textarea from '@/ui/atoms/dirk/Textarea';

import { restoreFromAgeBytes, tryAutoRestore } from './restore-backup';

/**
 * « Restaurer depuis le cloud » — on-demand restore of the connected provider's
 * backup (the Restaurer group). Rendered only when a provider is connected.
 * Tries the silent auto-derived phrase first (your own account); on a mismatch
 * (a different account/version sealed it) it asks for the 12 words. The merge is
 * NON-DESTRUCTIVE (`restoreFromAgeBytes` → `restoreEnvelope`: dedup by each
 * plugin's natural key, add only the records that are missing).
 */
export default function CloudRestorePanel() {
  const { t } = useI18n();
  const { preferences } = usePreferences();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const cb = preferences.cloudBackup;

  const [loading, setLoading] = useState(false);
  // The restore outcome banner: green for a real merge, amber for a partial one
  // (a module failed — re-run to finish), or a plain "already up to date".
  const [done, setDone] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [error, setError] = useState('');
  // Downloaded bytes held while we ask for the 12 words (auto-decrypt failed).
  const [pending, setPending] = useState<Uint8Array | null>(null);
  const [phrase, setPhrase] = useState('');

  if (!cb) return null;
  const name = PROVIDER_NAMES[cb.provider];

  function reportDone(count: number, parts: string[], hadFailures: boolean): void {
    if (count === 0 && !hadFailures) {
      // Phrase was right, but everything was already there (or the backup was
      // empty) — say so plainly instead of "complete · 0 entries".
      setDone({ tone: 'success', text: t('account.data.cloudBackup.cloudRestore.upToDate') });
      return;
    }
    const summary = t('account.data.import.successPrefix', {
      values: { count, parts: parts.join(' ; ') },
    });
    // A partial restore is amber, not green — it carries a "module failed — run
    // again" line and the user must re-run before the next auto-backup.
    setDone({ tone: hadFailures ? 'warning' : 'success', text: summary });
  }

  async function onRestore(): Promise<void> {
    if (!cb || !mainKey) return;
    setLoading(true);
    setDone(null);
    setError('');
    setPending(null);
    try {
      const bytes = await getProvider(cb.provider).download(cb);
      if (!bytes) {
        setError(t('account.data.cloudBackup.cloudRestore.none'));
        return;
      }
      const version = preferences.backupPhraseVersion ?? 1;
      const { ok, count, parts, hadFailures } = await tryAutoRestore(
        bytes,
        mainKey,
        version,
        modules,
        t,
      );
      if (ok) {
        reportDone(count, parts, hadFailures);
      } else {
        // Auto-derived phrase doesn't match (other account/version) → ask for
        // the 12 words of THIS backup.
        setPending(bytes);
      }
    } catch {
      setError(t('account.data.cloudBackup.cloudRestore.error'));
    } finally {
      setLoading(false);
    }
  }

  async function onRestoreWithPhrase(): Promise<void> {
    if (!pending || !mainKey) return;
    setLoading(true);
    setError('');
    try {
      const { count, parts, hadFailures } = await restoreFromAgeBytes(
        pending,
        normaliseMnemonic(phrase),
        mainKey,
        modules,
        t,
      );
      reportDone(count, parts, hadFailures);
      setPending(null);
      setPhrase('');
    } catch {
      setError(t('account.data.import.backupWrongPassphrase'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.cloudBackup.cloudRestore.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onRestore()}
            disabled={loading}
          >
            {loading
              ? t('account.data.cloudBackup.cloudRestore.loading')
              : t('account.data.cloudBackup.cloudRestore.cta', {
                  values: { provider: name },
                })}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {t('account.data.cloudBackup.cloudRestore.description', {
            values: { provider: name },
          })}
        </p>
      </div>

      {pending !== null ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-hair bg-bg-2/40 p-4">
          <p
            id="cloud-restore-phrase-prompt"
            role="status"
            className="mb-2 text-[12px] leading-[1.5] text-ink-soft"
          >
            {t('account.data.cloudBackup.cloudRestore.phrasePrompt')}
          </p>
          <label
            htmlFor="cloud-restore-phrase"
            className="block text-[12px] font-medium text-muted"
          >
            {t('account.data.import.backupPassphrase')}
          </label>
          <Textarea
            id="cloud-restore-phrase"
            aria-describedby="cloud-restore-phrase-prompt"
            aria-invalid={error ? true : undefined}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={t('account.data.import.backupPhrasePlaceholder')}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
            minHeightPx={64}
            className="mb-3 mt-1.5"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onRestoreWithPhrase()}
              disabled={loading || phrase.trim() === ''}
            >
              {loading
                ? t('account.data.import.backupRestoreLoading')
                : t('account.data.import.backupRestoreCta')}
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => {
                setPending(null);
                setPhrase('');
              }}
              disabled={loading}
            >
              {t('account.data.import.backupCancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {done ? (
        <InlineAlert tone={done.tone} className="mt-3">
          {done.text}
        </InlineAlert>
      ) : null}
      {error ? <InlineAlert className="mt-3">{error}</InlineAlert> : null}
    </section>
  );
}
