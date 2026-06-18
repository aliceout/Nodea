import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SecurityMode } from '@nodea/shared';

import { apiErrorMessage, isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useDocumentTitle } from '@/lib/use-document-title';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
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
  const { t } = useI18n();
  useDocumentTitle(t('auth.securityMode.documentTitle'));
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
      label: t('auth.securityMode.options.standard.label'),
      description: t('auth.securityMode.options.standard.description'),
      unmetRequirement: null,
    },
    {
      id: 'always_2fa',
      label: t('auth.securityMode.options.always2fa.label'),
      description: t('auth.securityMode.options.always2fa.description'),
      unmetRequirement: hasAny2ndFactor
        ? null
        : t('auth.securityMode.unmet.secondFactor'),
    },
    {
      id: 'maximum',
      label: t('auth.securityMode.options.maximum.label'),
      description: t('auth.securityMode.options.maximum.description'),
      unmetRequirement: !totpEnabled
        ? t('auth.securityMode.unmet.totp')
        : passkeysPrfCount === 0
          ? t('auth.securityMode.unmet.passkeyPrf')
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
      setSuccess(
        t('auth.securityMode.success', { values: { mode: labelFor(selected, t) } }),
      );
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
      headline={t('auth.securityMode.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.securityMode.marketing.p1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.securityMode.marketing.p2')}
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow={t('auth.securityMode.eyebrow')}
        title={t('auth.securityMode.title')}
        subtitle={<>{t('auth.securityMode.subtitle')}</>}
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
                <strong className="font-semibold text-ink">{labelFor(selected, t)}</strong>
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

      {error ? <InlineAlert className="mt-3">{error}</InlineAlert> : null}
      {success ? (
        <InlineAlert tone="success" className="mt-3">
          {success}
        </InlineAlert>
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
          {t('auth.back')}
        </button>
      </div>
    </AuthLayout>
  );
}

function labelFor(mode: SecurityMode, t: (key: string) => string): string {
  if (mode === 'password_or_passkey')
    return t('auth.securityMode.options.standard.label');
  if (mode === 'always_2fa')
    return t('auth.securityMode.options.always2fa.label');
  return t('auth.securityMode.options.maximum.label');
}
