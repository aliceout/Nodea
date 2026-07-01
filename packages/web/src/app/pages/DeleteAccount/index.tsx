import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDeleteMe, isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { freshenPasskeyReauth } from '@/core/auth/session/freshen-reauth';
import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import Field from '@/ui/atoms/dirk/Field';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

/**
 * Account-deletion tunnel (route `/delete-account`).
 *
 * Dedicated, irreversible ceremony reached from Settings → Suppression
 * du compte. Gates: retype the email, a fresh password proof
 * (`freshenPasswordReauth`), and an in-app confirm dialog — PLUS, per
 * Auth-Spec §6/§7.11 and enforced server-side, a fresh passkey assertion when
 * a passkey is enrolled and a live TOTP code when TOTP is enabled. We collect
 * both here so the delete is one click rather than a 401 round-trip. Only then
 * is the account purged and the session logged out.
 */
function isWebAuthnCancel(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'NotAllowedError'
  );
}

export default function DeleteAccountPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.deleteAccount.documentTitle'));
  const confirm = useConfirm();
  const session = useSession();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const setModule = useNodeaStore((s) => s.setModule);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Require a real, non-empty match — `(user?.email ?? '')` would let an
  // EMPTY field pass as `'' === ''` if the page ever rendered without a
  // session (the route isn't ProtectedRoute-guarded).
  const emailMatches =
    user?.email != null &&
    confirmEmail.trim().length > 0 &&
    confirmEmail.trim().toLowerCase() === user.email.toLowerCase();
  // When TOTP is on, a valid 6-digit code is also required (server enforces it).
  const totpOk = !user?.totpEnabled || /^\d{6}$/.test(totpCode.trim());

  function back(): void {
    setModule('account');
    navigate('/flow');
  }

  async function handleDelete(password: string): Promise<void> {
    setError(null);
    // Third gate (after email-match + fresh reauth) : explicit in-app
    // confirmation, to soften double-click accidents.
    const ok = await confirm({
      message: t('account.danger.windowConfirm'),
      tone: 'danger',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await freshenPasswordReauth(password);
      // §6/§7.11 — re-prove the account's 2FA before the irreversible delete:
      // a fresh passkey assertion if one is enrolled, then the live TOTP code
      // (in the body). The server independently enforces both.
      if ((user?.passkeysCount ?? 0) > 0) {
        await freshenPasskeyReauth();
      }
      const code = totpCode.trim();
      await apiDeleteMe(code ? { totpCode: code } : {});
      await session.logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      if (isWebAuthnCancel(err)) {
        setError(t('account.danger.passkeyCancelled'));
      } else if (isApiError(err) && err.status === 401) {
        const code = (err as { error?: string }).error;
        if (code === 'totp_required') setError(t('account.danger.wrongTotp'));
        else if (code === 'passkey_reauth_required')
          setError(t('account.danger.passkeyRequired'));
        else setError(t('account.danger.wrongPassword'));
      } else {
        setError(t('account.danger.error'));
        if (import.meta.env.DEV) console.warn('delete-account failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t('auth.deleteAccount.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.deleteAccount.marketing.p1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.deleteAccount.marketing.p2')}
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow={t('auth.deleteAccount.eyebrow')}
        title={t('account.danger.heading')}
        subtitle={t('account.danger.gateHint')}
      />

      <PasswordReauthForm
        size="lg"
        tone="danger"
        autoFocus={false}
        canConfirm={emailMatches && totpOk}
        passwordLabel={t('account.danger.passwordLabel')}
        confirmLabel={t('account.danger.cta')}
        submittingLabel={t('account.danger.ctaSubmitting')}
        submitting={submitting}
        error={error ?? undefined}
        onConfirm={handleDelete}
      >
        <Field
          label={t('account.danger.emailLabel')}
          type="email"
          autoComplete="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          error={
            confirmEmail.trim().length > 0 && !emailMatches
              ? t('account.danger.emailMismatch')
              : undefined
          }
        />

        {user?.totpEnabled ? (
          <Field
            label={t('account.danger.totpLabel')}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={totpCode}
            onChange={(e) =>
              setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
          />
        ) : null}
      </PasswordReauthForm>

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={back}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.back')}
        </button>
      </div>
    </AuthLayout>
  );
}
