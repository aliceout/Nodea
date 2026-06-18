import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

import { collectModules } from '@/app/flow/Account/views/data/collect-modules';

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
 */
type Stage = { kind: 'reauth' } | { kind: 'done'; failed: string[] };

export default function DataExportPage() {
  useDocumentTitle('Exporter mes données');
  const { t } = useI18n();
  const navigate = useNavigate();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const setModule = useNodeaStore((s) => s.setModule);
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
      headline="Tes données, en clair, chez toi."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            L’export rassemble toutes tes entrées déchiffrées dans un seul fichier
            JSON, généré entièrement dans ton navigateur. Rien ne transite par le
            serveur.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Comme il sort tout en clair, on te redemande ton mot de passe : une
            preuve fraîche que c’est bien toi.
          </p>
        </>
      }
    >
      {stage.kind === 'reauth' ? (
        <>
          <AuthPanelHeader
            eyebrow="Données"
            title="Exporter mes données"
            subtitle="Tape ton mot de passe pour autoriser l’export."
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
          <AuthPanelHeader eyebrow="Données" title={t('account.data.export.success')} />
        </div>
      )}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={back}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour
        </button>
      </div>
    </AuthLayout>
  );
}
