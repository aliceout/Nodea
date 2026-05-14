import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDeleteMe, isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import Feedback from '../components/Feedback';
import Field from '../components/Field';

/** « Suppression du compte » tab — irreversible delete with two
 *  confirmations : the user must retype their email and supply
 *  their current password. The password reauth has to be fresh
 *  (`freshenPasswordReauth`) so the server sees a recent proof
 *  before honouring `apiDeleteMe`. A `window.confirm` adds a
 *  third gate to soften double-click accidents. */
export default function DangerTab() {
  const { t } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete =
    confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase() &&
    currentPassword.length > 0;

  async function handleDelete(): Promise<void> {
    setError(null);
    if (!canDelete) {
      setError(t('account.danger.confirmGate'));
      return;
    }
    if (!window.confirm(t('account.danger.windowConfirm'))) {
      return;
    }
    setSubmitting(true);
    try {
      await freshenPasswordReauth(currentPassword);
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
    <div className="grid max-w-[1100px] grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div className="max-w-90">
        <div className="mb-2 text-[12px] font-semibold tracking-[0.02em] text-danger">
          {t('account.danger.heading')}
        </div>
        <Field
          label={t('account.danger.emailLabel')}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          type="email"
        />
        <Field
          label={t('account.danger.passwordLabel')}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          type="password"
        />
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={submitting || !canDelete}
        >
          {submitting ? t('account.danger.ctaSubmitting') : t('account.danger.cta')}
        </Button>
        {error ? <Feedback tone="error">{error}</Feedback> : null}
      </div>
      <p className="text-[13px] leading-[1.55] text-muted">
        {t('account.danger.explanation')}
      </p>
    </div>
  );
}
