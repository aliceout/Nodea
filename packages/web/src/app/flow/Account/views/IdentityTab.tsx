import { useState } from 'react';

import {
  apiChangeEmail,
  apiChangeUsername,
  apiMe,
  isApiError,
} from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import IdentityRow from '../components/IdentityRow';
import Stats from '../components/Stats';
import type { FeedbackState } from '../lib/types';

/** « Identité » tab — username + e-mail edits.
 *
 * Each field has its own edit lifecycle (draft, submitting,
 * feedback) so saving the e-mail doesn't reset a username draft
 * and vice versa. The e-mail change requires a fresh password
 * proof (`freshenPasswordReauth`) so the legacy mainKey envelope
 * stays valid across the change.
 */
export default function IdentityTab() {
  const { t } = useI18n();
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? '');
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);
  const [usernameFeedback, setUsernameFeedback] =
    useState<FeedbackState | null>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<FeedbackState | null>(null);

  function startEditUsername(): void {
    setUsernameDraft(user?.username ?? '');
    setUsernameFeedback(null);
    setEditingUsername(true);
  }
  function cancelEditUsername(): void {
    setUsernameDraft(user?.username ?? '');
    setUsernameFeedback(null);
    setEditingUsername(false);
  }
  async function saveUsername(): Promise<void> {
    setUsernameSubmitting(true);
    setUsernameFeedback(null);
    try {
      const trimmed = usernameDraft.trim();
      const next = trimmed.length === 0 ? null : trimmed;
      const current = user?.username ?? null;
      if (next === current) {
        setEditingUsername(false);
        return;
      }
      await apiChangeUsername({ username: next });
      const me = await apiMe();
      if (me) setAuth(me);
      setUsernameFeedback({ tone: 'success', text: t('account.identity.username.feedback.success') });
      setEditingUsername(false);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setUsernameFeedback({ tone: 'error', text: t('account.identity.username.feedback.taken') });
      } else if (isApiError(err) && err.status === 400) {
        setUsernameFeedback({ tone: 'error', text: t('account.identity.username.feedback.invalid') });
      } else {
        setUsernameFeedback({ tone: 'error', text: t('account.identity.username.feedback.error') });
        if (import.meta.env.DEV) console.warn('account-username failed', err);
      }
    } finally {
      setUsernameSubmitting(false);
    }
  }

  function startEditEmail(): void {
    setEmailDraft(user?.email ?? '');
    setEmailPassword('');
    setEmailFeedback(null);
    setEditingEmail(true);
  }
  function cancelEditEmail(): void {
    setEmailDraft(user?.email ?? '');
    setEmailPassword('');
    setEmailFeedback(null);
    setEditingEmail(false);
  }
  async function saveEmail(): Promise<void> {
    setEmailSubmitting(true);
    setEmailFeedback(null);
    try {
      const next = emailDraft.trim();
      if (next === (user?.email ?? '')) {
        setEditingEmail(false);
        return;
      }
      if (!emailPassword) {
        setEmailFeedback({
          tone: 'error',
          text: t('account.identity.email.passwordRequired'),
        });
        setEmailSubmitting(false);
        return;
      }
      await freshenPasswordReauth(emailPassword);
      await apiChangeEmail({ newEmail: next });
      const me = await apiMe();
      if (me) setAuth(me);
      setEmailPassword('');
      setEmailFeedback({ tone: 'success', text: t('account.identity.email.feedback.success') });
      setEditingEmail(false);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setEmailFeedback({ tone: 'error', text: t('account.identity.email.feedback.wrongPassword') });
      } else if (isApiError(err) && err.status === 409) {
        setEmailFeedback({ tone: 'error', text: t('account.identity.email.feedback.taken') });
      } else if (isApiError(err) && err.status === 400) {
        setEmailFeedback({ tone: 'error', text: t('account.identity.email.feedback.invalid') });
      } else {
        setEmailFeedback({ tone: 'error', text: t('account.identity.email.feedback.error') });
        if (import.meta.env.DEV) console.warn('account-email failed', err);
      }
    } finally {
      setEmailSubmitting(false);
    }
  }

  return (
    <div className="grid max-w-[880px] grid-cols-1 gap-14 lg:grid-cols-[1fr_240px]">
      <div className="divide-y divide-hair">
        <IdentityRow
          label={t('account.identity.username.label')}
          value={user?.username ?? ''}
          placeholder={t('account.identity.username.placeholder')}
          editing={editingUsername}
          editLabel={t('account.identity.username.editLabel')}
          submitting={usernameSubmitting}
          feedback={usernameFeedback}
          onEdit={startEditUsername}
          onCancel={cancelEditUsername}
          onSave={saveUsername}
        >
          <input
            type="text"
            value={usernameDraft}
            onChange={(e) => setUsernameDraft(e.target.value)}
            autoFocus
            className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
        </IdentityRow>

        <IdentityRow
          label={t('account.identity.email.label')}
          value={user?.email ?? ''}
          placeholder=""
          editing={editingEmail}
          editLabel={t('account.identity.email.editLabel')}
          submitting={emailSubmitting}
          feedback={emailFeedback}
          onEdit={startEditEmail}
          onCancel={cancelEditEmail}
          onSave={saveEmail}
        >
          <div className="space-y-2.5">
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              autoComplete="email"
              autoFocus
              className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder={t('account.identity.email.passwordPlaceholder')}
              autoComplete="current-password"
              className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>
        </IdentityRow>
      </div>

      <Stats />
    </div>
  );
}
