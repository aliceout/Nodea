import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { usePreferences } from '@/core/auth/use-preferences';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

import { collectModules } from '@/app/flow/Account/views/data/collect-modules';
import { isBackupPhraseConfirmed } from '@/app/flow/Account/views/data/phrase-gate';

/**
 * Plaintext data-export tunnel (route `/export`).
 *
 * Dedicated re-auth page — same ceremony as `/recovery-code`, `/totp`,
 * `/security-mode` — reached from Settings → Données → « Exporter ».
 * Writing every decrypted record to disk in clear is sensitive, so it
 * sits behind a fresh password proof (`freshenPasswordReauth`, the
 * 5-minute window the re-auth matrix checks). The file is built and
 * downloaded entirely client-side ; nothing round-trips the server.
 *
 * The encrypted, account-portable backup has its own tunnel (`/backup`)
 * which adds a passphrase step after this same proof.
 *
 * GATE: like `ExportPanel`, the export is locked until the backup phrase is
 * confirmed (`isBackupPhraseConfirmed`). The panel's menu item is disabled, but
 * this route is reachable by typing the URL — so the gate is enforced HERE too,
 * else the plaintext `.json` would be a way to sidestep recording the phrase
 * (the thing ADR-0017 + tech.md promise it can't). `.age`'s tunnel (`/backup`)
 * self-gates: it IS the confirmation ceremony.
 */
type Stage = { kind: 'reauth' } | { kind: 'done'; failed: string[] };

export default function DataExportPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.dataExport.documentTitle'));
  const navigate = useNavigate();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const setModule = useNodeaStore((s) => s.setModule);
  const { preferences } = usePreferences();
  const phraseReady = isBackupPhraseConfirmed(preferences);
  const [stage, setStage] = useState<Stage>({ kind: 'reauth' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function back(): void {
    setModule('account');
    navigate('/flow');
  }

  function downloadExport(out: Record<string, unknown>, failed: string[]): void {
    const payload = {
      meta: {
        version: 1,
        exported_at: new Date().toISOString(),
        app: 'Nodea',
        ...(failed.length > 0 ? { failed_modules: failed } : {}),
      },
      modules: out,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodea_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    // Defer revoke a tick — some browsers abort an in-flight download if
    // the object URL is revoked synchronously after click.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function onConfirm(password: string): Promise<void> {
    setError(null);
    if (!mainKey) {
      setError(t('account.data.export.noKey'));
      return;
    }
    setSubmitting(true);
    try {
      await freshenPasswordReauth(password);
      const { out, failed } = await collectModules(mainKey, modules, (key, err) => {
        if (import.meta.env.DEV) console.error(`Export ${key} failed:`, err);
      });
      if (Object.keys(out).length === 0) {
        setError(t('account.data.export.empty'));
        return;
      }
      downloadExport(out, failed);
      setStage({ kind: 'done', failed });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError(t('account.danger.wrongPassword'));
      } else {
        setError(String((err as Error)?.message ?? err));
        if (import.meta.env.DEV) console.warn('plaintext export reauth failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t('auth.dataExport.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.dataExport.marketing1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.dataExport.marketing2')}
          </p>
        </>
      }
    >
      {!phraseReady ? (
        // Gate: no password form until the backup phrase is confirmed, so the
        // plaintext .json can't sidestep it (matches ExportPanel / ADR-0017).
        <div role="status">
          <AuthPanelHeader
            eyebrow={t('auth.dataExport.eyebrow')}
            title={t('account.data.phraseGate.title')}
            subtitle={t('account.data.phraseGate.intro')}
          />
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/backup?confirm')}
          >
            {t('account.data.phraseGate.setupCta')}
          </Button>
        </div>
      ) : stage.kind === 'reauth' ? (
        <>
          <AuthPanelHeader
            eyebrow={t('auth.dataExport.eyebrow')}
            title={t('auth.dataExport.panelTitle')}
            subtitle={t('auth.dataExport.subtitle')}
          />
          <PasswordReauthForm
            size="lg"
            canConfirm={mainKey != null}
            passwordLabel={t('account.data.export.passwordLabel')}
            confirmLabel={t('account.data.export.confirmCta')}
            submittingLabel={t('account.data.export.ctaLoading')}
            submitting={submitting}
            error={error ?? undefined}
            onConfirm={onConfirm}
          />
        </>
      ) : stage.failed.length > 0 ? (
        // Partial run must NOT read as « ✓ réussi » (audit 2026-06) :
        // a danger live-region, never the green success heading.
        <InlineAlert>
          {t('account.data.export.partial', {
            values: { modules: stage.failed.join(', ') },
          })}
        </InlineAlert>
      ) : (
        <div role="status">
          <AuthPanelHeader eyebrow={t('auth.dataExport.eyebrow')} title={t('account.data.export.success')} />
        </div>
      )}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={back}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.dataExport.back')}
        </button>
      </div>
    </AuthLayout>
  );
}
