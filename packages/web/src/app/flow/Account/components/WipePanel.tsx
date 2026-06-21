import { useState } from 'react';

import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { PartialWipeError, wipeModule } from '@/core/modules/wipe-module';
import { useNodeaStore, type NodeaState } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

/** Map module id → the store version bumps to fire after a successful
 *  wipe, so any mounted consumer refetches instead of showing stale
 *  rows. Typed (each value calls the real store actions) so a renamed
 *  bump action fails to compile rather than silently no-op'ing the
 *  refetch — the failure mode would be a stale UI after a destructive
 *  action. Modules absent here (habits / review / hrt) have no store
 *  version — their hooks refetch on every page mount, which is enough
 *  since Settings is a different surface. */
const WIPE_VERSION_BUMPS: Record<string, (s: NodeaState) => void> = {
  mood: (s) => s.bumpMoodVersion(),
  journal: (s) => s.bumpJournalVersion(),
  goals: (s) => s.bumpGoalsVersion(),
  library: (s) => {
    s.bumpLibraryItemsVersion();
    s.bumpLibraryReviewsVersion();
  },
};

/**
 * Inline destructive confirmation expanded under a module row in
 * `ModulesManager`. Owns the password re-auth + the wipe fan-out.
 * Closes via `onClose` ; on success the relevant store versions are
 * bumped so mounted consumers refetch.
 *
 * A top-level component ON PURPOSE (audit 2026-06) — declaring it inside
 * `ModulesManager`'s body changed its identity on every parent render,
 * so React unmounted/remounted it and wiped the typed password +
 * dropped the « wiping » progress state mid-flight. Living in its own
 * file keeps that identity stable (REFACTO-08 just moved it out of the
 * parent file ; the stability guarantee is unchanged).
 */
export default function WipePanel({
  moduleId,
  moduleLabel,
  sid,
  onClose,
}: {
  moduleId: string;
  moduleLabel: string;
  sid: string;
  onClose: () => void;
}) {
  const { t, tn } = useI18n();
  const [phase, setPhase] = useState<'idle' | 'wiping' | 'done'>('idle');
  const [panelError, setPanelError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  async function handleConfirm(password: string): Promise<void> {
    setPanelError(null);
    setPhase('wiping');
    try {
      // Step 1 : OPAQUE re-auth round-trip — same posture as the
      // plaintext-export gate in `ExportPanel`. Stamps a fresh
      // `reauth_password_at` on the session so the wipe endpoint's
      // `requireFreshPassword` middleware lets the calls through
      // for the next 5 minutes.
      await freshenPasswordReauth(password);
      // Step 2 : fan out one POST /records/wipe per collection
      // the module owns. The server-side delete is one transaction
      // per call ; we let the helper iterate the list.
      const result = await wipeModule(moduleId, sid);
      setDeletedCount(result.deleted);
      // Refetch trigger for mounted consumers of this module's data.
      WIPE_VERSION_BUMPS[moduleId]?.(useNodeaStore.getState());
      setPhase('done');
    } catch (err) {
      setPhase('idle');
      if (isApiError(err) && err.status === 401) {
        setPanelError(
          t('settings.modules.wipe.wrongPassword', {
            defaultValue: 'Mot de passe incorrect.',
          }),
        );
      } else if (err instanceof PartialWipeError) {
        // Mid-list failure : say exactly what WAS wiped so the user
        // doesn't have to guess which data survived (audit 2026-06).
        const wiped = err.partial.map((p) => p.collection).join(', ');
        setPanelError(
          err.partial.length === 0
            ? t('settings.modules.wipe.failedNone', {
                defaultValue: 'Échec — aucune donnée n’a été supprimée.',
              })
            : t('settings.modules.wipe.failedPartial', {
                defaultValue: `Échec en cours de route. Déjà vidé : ${wiped}. Relance pour terminer.`,
                values: { wiped },
              }),
        );
        if (import.meta.env.DEV)
          console.warn('wipe module partial failure', moduleId, err);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setPanelError(msg);
        if (import.meta.env.DEV)
          console.warn('wipe module failed', moduleId, err);
      }
    }
  }

  if (phase === 'done') {
    return (
      <div
        role="status"
        className="border-t border-hair bg-bg-2/40 px-4 py-4 text-[13px] text-ink"
      >
        <p>
          {tn('settings.modules.wipe.done', deletedCount, {
            values: { module: moduleLabel },
          })}
        </p>
        <div className="mt-3">
          <Button variant="neutral" size="sm" onClick={onClose}>
            {t('common.actions.close', { defaultValue: 'Fermer' })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby={`wipe-${moduleId}-title`}
      className="border-t border-danger/30 bg-danger/5 px-4 py-4"
    >
      <p
        id={`wipe-${moduleId}-title`}
        className="text-[13px] font-medium text-ink"
      >
        {t('settings.modules.wipe.title', {
          defaultValue: `Vider toutes les entrées de ${moduleLabel} ?`,
          values: { module: moduleLabel },
        })}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        {t('settings.modules.wipe.description', {
          defaultValue:
            'Action irréversible. Le module reste activé mais toutes ses entrées chiffrées sont supprimées du serveur. Saisis ton mot de passe pour confirmer.',
        })}
      </p>
      <div className="mt-3 max-w-sm">
        <PasswordReauthForm
          tone="danger"
          passwordLabel={t('settings.modules.wipe.passwordLabel', {
            defaultValue: 'Mot de passe actuel',
          })}
          confirmLabel={t('settings.modules.wipe.confirm', {
            defaultValue: 'Confirmer la suppression',
          })}
          submittingLabel={t('settings.modules.wipe.wiping', {
            defaultValue: 'Suppression…',
          })}
          cancelLabel={t('common.actions.cancel', { defaultValue: 'Annuler' })}
          onCancel={onClose}
          error={panelError ?? undefined}
          submitting={phase === 'wiping'}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
