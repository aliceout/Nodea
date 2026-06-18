import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/** State machine for the « lost factor » email-recovery flow. */
export type LostState =
  | { kind: 'idle' }
  | { kind: 'confirm'; factor: 'totp' | 'passkey'; submitting: boolean }
  | { kind: 'sent'; factor: 'totp' | 'passkey'; earliestApplyAt: string };

interface LostFlowProps {
  lost: LostState;
  /** Factor of the parent step. The flow only renders when
   *  `lost.factor` matches this value — the user never has two
   *  flows open simultaneously. */
  factor: 'totp' | 'passkey';
  onConfirm: () => void;
  /** Reset `lost` to `idle` so the parent's form re-appears.
   *  Used by the « ← Annuler » link to back out of the panel
   *  without sending the email. Not exposed in the `sent`
   *  state since the email has already gone out. */
  onCancel: () => void;
}

/**
 * Inline panel that takes over the parent step when the user
 * clicks « Demander une récupération par email ». Lives in two
 * states :
 *
 *   - `confirm` — surface the side-effects (TOTP wiped, passkeys
 *     cleared) and a single explicit « Envoyer l'email » CTA so
 *     the user has to opt in to the destructive recovery.
 *   - `sent` — minimal confirmation screen ; the email is on its
 *     way. No back-out from here ; the next move is in the email.
 *
 * Returns null in the `idle` state and when the active factor
 * doesn't match — that's how the parent gates rendering without
 * a parallel boolean prop.
 */
export default function LostFlow({
  lost,
  factor,
  onConfirm,
  onCancel,
}: LostFlowProps) {
  const { t } = useI18n();

  if (lost.kind === 'idle') return null;
  if (lost.factor !== factor) return null;

  const verbose =
    factor === 'totp'
      ? t('auth.mfa.lost.factorTotp')
      : t('auth.mfa.lost.factorPasskey');
  const sideEffect =
    factor === 'totp'
      ? t('auth.mfa.lost.sideEffectTotp')
      : t('auth.mfa.lost.sideEffectPasskey');

  if (lost.kind === 'confirm') {
    return (
      <>
        <AuthPanelHeader
          eyebrow={t('auth.mfa.eyebrow')}
          title={t('auth.mfa.lost.confirmTitle', { values: { factor: verbose } })}
          subtitle={
            <>
              {t('auth.mfa.lost.confirmSubtitle', {
                values: { factor: verbose, sideEffect },
              })}
            </>
          }
        />

        <Button
          variant="danger-outline"
          size="lg"
          onClick={onConfirm}
          disabled={lost.submitting}
          className="w-full"
        >
          {lost.submitting
            ? t('common.states.submitting')
            : t('auth.mfa.lost.sendEmailCta')}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            disabled={lost.submitting}
            className="cursor-pointer transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('auth.mfa.lost.cancel')}
          </button>
        </div>
      </>
    );
  }

  // `sent` — terminal screen, no back-out
  return (
    <AuthPanelHeader
      eyebrow={t('auth.mfa.eyebrow')}
      title={t('auth.mfa.lost.sentTitle')}
      subtitle={
        <>
          {t('auth.mfa.lost.sentSubtitle', { values: { factor: verbose } })}
        </>
      }
    />
  );
}
