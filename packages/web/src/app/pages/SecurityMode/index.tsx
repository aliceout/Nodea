import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SecurityMode } from '@nodea/shared';

import { apiErrorMessage, isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

import ModeSelector, { type ModeOption } from './ModeSelector';

/**
 * Settings → Mode de sécurité (Auth-Roadmap Phase 5D, Auth-Spec §6.1).
 *
 * Standalone page (parallel layout to `/totp`, `/passkeys`,
 * `/recovery-code`) — three-card mode picker with prerequisite
 * gates and an inline password confirm form. The matrice de re-auth
 * (§6) requires a fresh password proof for every mode change.
 *
 * Requirements :
 *   - `password_or_passkey` — always reachable (downgrade path).
 *   - `always_2fa`         — TOTP must be enabled.
 *   - `maximum`             — TOTP enabled AND ≥ 1 PRF passkey.
 *
 * Cards whose prerequisites are unmet are disabled with a helper
 * line pointing the user to the right place (`/totp`, `/passkeys`).
 *
 * Split (REFACTO-12) :
 *   - `ModeSelector` renders the 3 cards.
 *   - `PasswordReauthForm` (shared) collects the confirmation password.
 *   - This file orchestrates : option list derivation, click +
 *     confirm handlers, error / success rendering, AuthLayout wrap.
 */
export default function SecurityModePage() {
  useDocumentTitle('Mode de sécurité');
  const { t } = useI18n();
  const navigate = useNavigate();
  const setModule = useNodeaStore((s) => s.setModule);
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const currentMode = user?.securityMode ?? 'password_or_passkey';
  const totpEnabled = user?.totpEnabled === true;
  const passkeysCount = user?.passkeysCount ?? 0;
  const passkeysPrfCount = user?.passkeysPrfCount ?? 0;
  const hasAny2ndFactor = totpEnabled || passkeysCount > 0;

  const [selected, setSelected] = useState<SecurityMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const options: ReadonlyArray<ModeOption> = [
    {
      id: 'password_or_passkey',
      label: 'Standard',
      description:
        'Mot de passe OU passkey suffit pour se connecter. Le défaut.',
      unmetRequirement: null,
    },
    {
      id: 'always_2fa',
      label: '2FA requis',
      description:
        '2ᵉ facteur en plus à chaque connexion : code TOTP ou passkey, au choix. Configure au moins un des deux pour pouvoir le sélectionner.',
      unmetRequirement: hasAny2ndFactor
        ? null
        : 'Active TOTP ou enrôle une passkey avant.',
    },
    {
      id: 'maximum',
      label: 'Maximum',
      description:
        'Mot de passe + passkey + TOTP, les trois. Une passkey PRF-capable obligatoire.',
      unmetRequirement: !totpEnabled
        ? 'Active TOTP avant.'
        : passkeysPrfCount === 0
          ? 'Enrôle une passkey PRF avant.'
          : null,
    },
  ];

  function handleClickMode(mode: SecurityMode): void {
    setError(null);
    setSuccess(null);
    if (mode === currentMode) {
      setSelected(null);
      return;
    }
    const target = options.find((o) => o.id === mode);
    if (target?.unmetRequirement) {
      setError(target.unmetRequirement);
      setSelected(null);
      return;
    }
    setSelected(mode);
  }

  async function handleConfirm(password: string): Promise<void> {
    if (selected === null) return;
    setError(null);
    setSubmitting(true);
    try {
      await session.changeSecurityMode(selected, password);
      setSuccess(`Mode mis à jour : ${labelFor(selected)}.`);
      setSelected(null);
    } catch (err) {
      // Page-specific overrides : back-end error codes map to
      // actionable hints. The generic helper would translate them to
      // neutral phrases ; we want the user pointed to the right
      // setting.
      if (isApiError(err) && err.error === 'totp_required') {
        setError(
          t('errors.securityMode.totpRequired', {
            defaultValue: 'Active TOTP avant de choisir ce mode.',
          }),
        );
      } else if (isApiError(err) && err.error === 'passkey_required') {
        setError(
          t('errors.securityMode.passkeyRequired', {
            defaultValue: 'Enrôle une passkey PRF avant de choisir ce mode.',
          }),
        );
      } else if (isApiError(err) && err.error === 'second_factor_required') {
        setError(
          t('errors.securityMode.secondFactorRequired', {
            defaultValue:
              'Active TOTP ou enrôle une passkey avant de choisir ce mode.',
          }),
        );
      } else {
        setError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('security-mode change failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline="Combien de facteurs à chaque login."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mode de sécurité gouverne ce que tu dois fournir à chaque
            connexion : mot de passe seul, mot de passe + TOTP, ou les trois
            facteurs (mot de passe + passkey + TOTP).
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Plus tu montes en exigence, plus tu protèges l’accès — au prix
            d’une étape supplémentaire au login. Tes données sont déjà
            chiffrées côté client : le mode ne change pas la crypto, juste les
            preuves demandées au serveur.
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow="Sécurité"
        title="Mode de sécurité"
        subtitle={
          <>
            Choisis combien de facteurs sont requis à chaque connexion. Un
            changement nécessite ton mot de passe.
          </>
        }
      />

      <ModeSelector
        options={options}
        currentMode={currentMode}
        selected={selected}
        onSelect={handleClickMode}
      />

      {selected !== null ? (
        <div className="mt-3">
          <PasswordReauthForm
            prompt={
              <>
                {t('auth.securityMode.passwordProof.instructionBefore')}
                <strong className="font-semibold text-ink">{labelFor(selected)}</strong>
                {t('auth.securityMode.passwordProof.instructionAfter')}
              </>
            }
            passwordLabel={t('auth.securityMode.passwordProof.passwordPlaceholder')}
            confirmLabel={t('common.actions.confirm')}
            cancelLabel={t('common.actions.cancel')}
            submitting={submitting}
            onConfirm={handleConfirm}
            onCancel={() => {
              setSelected(null);
              setError(null);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="mt-3 border-l-2 border-accent bg-accent/5 px-3 py-2 text-[12.5px] text-accent-deep"
        >
          {success}
        </div>
      ) : null}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={() => {
            setModule('account');
            navigate('/flow');
          }}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour
        </button>
      </div>
    </AuthLayout>
  );
}

function labelFor(mode: SecurityMode): string {
  if (mode === 'password_or_passkey') return 'Standard';
  if (mode === 'always_2fa') return '2FA requis';
  return 'Maximum';
}
