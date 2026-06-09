import { useState } from 'react';

import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import Feedback from '../../components/Feedback';
import Field from '../../components/Field';
import { collectModules } from './collect-modules';

/** « Exporter » panel on the Data tab.
 *
 * Walks every known module, asks each for its decrypted entries
 * via `plugin.exportQuery`, and bundles them into a single JSON
 * file generated entirely client-side — the export never
 * round-trips through the server, so the user's plaintext stays
 * inside their browser. Failures on a single module are
 * non-fatal : the export still produces a file with the modules
 * that did respond.
 *
 * **Re-auth gate (audit v2.8.0).** Writing every decrypted record
 * onto the user's disk in clear is a sensitive action — same risk
 * profile as deleting the account or rotating the recovery code. The
 * button now arms a confirmation block that requires the current
 * password (mirroring the DangerTab pattern via
 * `freshenPasswordReauth`) before the download triggers ; a shoulder-
 * surfer with a logged-in session can no longer one-click the
 * plaintext out of the browser. The encrypted-backup path on the
 * `BackupExportPanel` keeps its existing passphrase-only flow — the
 * encryption itself is the gate there. */
export default function ExportPanel() {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // `'idle'` = the trigger button is visible ; `'confirm'` = the
  // password field + confirm CTA is visible. We never auto-close the
  // confirm panel on success so a user re-exporting in quick
  // succession can stay armed without re-typing.
  const [stage, setStage] = useState<'idle' | 'confirm'>('idle');
  const [password, setPassword] = useState('');

  async function runExport(): Promise<void> {
    if (!mainKey) throw new Error(t('account.data.export.noKey'));
    const out = await collectModules(mainKey, modules, (moduleKey, err) => {
      if (import.meta.env.DEV) console.error(`Export ${moduleKey} failed:`, err);
    });
    if (Object.keys(out).length === 0) {
      setError(t('account.data.export.empty'));
      return;
    }
    const payload = {
      meta: { version: 1, exported_at: new Date().toISOString(), app: 'Nodea' },
      modules: out,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodea_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess(t('account.data.export.success'));
  }

  async function handleConfirm(): Promise<void> {
    setSuccess('');
    setError('');
    if (!password) {
      setError(t('account.data.export.passwordRequired', {
        defaultValue: 'Renseigne ton mot de passe pour confirmer.',
      }));
      return;
    }
    setLoading(true);
    try {
      // Same posture as DangerTab : refuse to download until the
      // server has just re-verified the current password via OPAQUE.
      // No record of the reauth survives beyond the 5-minute fresh
      // window the middleware checks for other sensitive actions.
      await freshenPasswordReauth(password);
      setPassword('');
      await runExport();
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError(t('account.danger.wrongPassword'));
      } else {
        setError(String((err as Error)?.message ?? err));
        if (import.meta.env.DEV) console.warn('plaintext export reauth failed', err);
      }
    } finally {
      setLoading(false);
    }
  }

  function arm(): void {
    setSuccess('');
    setError('');
    setStage('confirm');
  }

  function cancel(): void {
    setStage('idle');
    setPassword('');
    setError('');
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{t('account.data.export.title')}</h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          {stage === 'idle' ? (
            <Button variant="primary" size="sm" onClick={arm} disabled={!mainKey}>
              {t('account.data.export.cta')}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Field
                label={t('account.data.export.passwordLabel', {
                  defaultValue: 'Mot de passe actuel',
                })}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                type="password"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={loading || !mainKey || password.length === 0}
                >
                  {loading
                    ? t('account.data.export.ctaLoading')
                    : t('account.data.export.confirmCta', {
                        defaultValue: 'Confirmer l’export',
                      })}
                </Button>
                <Button variant="neutral" size="sm" onClick={cancel} disabled={loading}>
                  {t('common.actions.cancel', { defaultValue: 'Annuler' })}
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {t('account.data.export.description')}
        </p>
      </div>
      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </section>
  );
}
