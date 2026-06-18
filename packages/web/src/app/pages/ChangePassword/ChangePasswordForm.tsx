import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import { apiErrorMessage } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import PasswordRulesList from '@/ui/atoms/auth/PasswordRulesList';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirmPassword: z.string().min(1).max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'auth.recover.form.confirmMismatch',
  });
type ChangePasswordForm = z.infer<typeof ChangePasswordFormSchema>;

/**
 * Change-password form (REFACTO-12 split). Mirrors the strength UX
 * from Register : live rule list (12 chars + upper / lower / digit /
 * special), zxcvbn strength bar, double-typed confirmation. Submit
 * is gated on every rule + matching confirmation + zxcvbn ≥ 3.
 *
 * On success, calls `session.logout('/login?password-changed=1')` —
 * the server already revoked every session in the change-password
 * transaction, the local main-key material derived from the OLD
 * password is no longer authoritative, and `session.logout` does
 * the full `location.replace` (CLAUDE.md crypto rule 7) so the JS
 * heap is purged. The user lands on /login with the success banner.
 */
export default function ChangePasswordForm() {
  const { t } = useI18n();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [serverError, setServerError] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const rules = useMemo(() => checkPasswordRules(newPwd), [newPwd]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!newPwd) return null;
    const { score, feedback } = zxcvbn(newPwd);
    return { score, warning: feedback.warning ?? null };
  }, [newPwd]);
  const confirmMismatch = confirmPwd.length > 0 && confirmPwd !== newPwd;

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: ChangePasswordForm): Promise<void> {
    setServerError(null);
    if (!user) {
      setServerError(t('auth.changePassword.errors.noSession'));
      return;
    }
    if (!rulesOk) {
      setServerError(t('auth.changePassword.errors.rulesNotMet'));
      return;
    }
    if ((strength?.score ?? 0) < 3) {
      setServerError(t('auth.changePassword.errors.tooWeak'));
      return;
    }
    try {
      await session.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
    } catch (err) {
      setServerError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('change-password failed', err);
      return;
    }

    // Force a logout + redirect. `session.logout('/login?…')` does
    // the hard `location.replace` itself (full RAM purge per
    // CLAUDE.md crypto rule 7), landing on /login with the success
    // banner.
    await session.logout('/login?password-changed=1').catch(() => undefined);
  }

  const newPasswordRegister = field('newPassword', {
    onChange: (e) => setNewPwd(e.target.value),
  });
  const confirmRegister = field('confirmPassword', {
    onChange: (e) => setConfirmPwd(e.target.value),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field
        label={t('auth.changePassword.currentPasswordLabel')}
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...field('currentPassword')}
      />

      <Field
        label={t('auth.changePassword.newPasswordLabel')}
        type="password"
        autoComplete="new-password"
        required
        error={errors.newPassword?.message}
        {...newPasswordRegister}
      />

      <PasswordRulesList rules={rules} />
      {strength ? (
        <StrengthBar
          score={strength.score}
          warning={strength.warning}
          rulesOk={rulesOk}
        />
      ) : null}

      <Field
        label={t('auth.changePassword.confirmNewPasswordLabel')}
        type="password"
        autoComplete="new-password"
        required
        error={
          confirmMismatch || errors.confirmPassword
            ? t('auth.recover.form.confirmMismatch')
            : undefined
        }
        {...confirmRegister}
      />

      {serverError ? (
        <InlineAlert className="mb-3">{serverError}</InlineAlert>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={
          isSubmitting || !rulesOk || confirmMismatch || newPwd !== confirmPwd
        }
        className="mt-2 w-full"
      >
        {isSubmitting
          ? t('common.states.updating')
          : t('auth.changePassword.submitCta')}
      </Button>
    </form>
  );
}
