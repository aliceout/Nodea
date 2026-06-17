import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDeleteMe, isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
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
 * du compte. Three gates, unchanged from the old inline form: retype
 * the email, a fresh password proof (`freshenPasswordReauth`, required
 * server-side by `apiDeleteMe`'s middleware), and an in-app confirm
 * dialog. Only then is the account purged and the session logged out.
 */
export default function DeleteAccountPage() {
  useDocumentTitle('Suppression du compte');
  const { t } = useI18n();
  const confirm = useConfirm();
  const session = useSession();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const setModule = useNodeaStore((s) => s.setModule);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Require a real, non-empty match — `(user?.email ?? '')` would let an
  // EMPTY field pass as `'' === ''` if the page ever rendered without a
  // session (the route isn't ProtectedRoute-guarded).
  const emailMatches =
    user?.email != null &&
    confirmEmail.trim().length > 0 &&
    confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

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
      await apiDeleteMe({});
      await session.logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError(t('account.danger.wrongPassword'));
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
      headline="Une suppression sans retour."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Supprimer le compte efface toutes tes entrées chiffrées, tes sessions
            et tes invitations. Aucune récupération n’est possible — pense à
            exporter avant.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Trois confirmations : retape ton e-mail, ton mot de passe, puis une
            dernière validation.
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow="Compte"
        title={t('account.danger.heading')}
        subtitle={t('account.danger.gateHint')}
      />

      <PasswordReauthForm
        size="lg"
        tone="danger"
        autoFocus={false}
        canConfirm={emailMatches}
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
      </PasswordReauthForm>

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
