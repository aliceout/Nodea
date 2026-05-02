import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { useDocumentTitle } from '@/lib/use-document-title';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
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
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type ChangePasswordForm = z.infer<typeof ChangePasswordFormSchema>;

/**
 * Change-password page — Direction K · Sauge.
 *
 * Mirrors `Register.tsx`'s strength UX: live rule list (12 chars +
 * upper/lower/digit/special), zxcvbn strength bar, double-typed
 * confirmation. Submission is gated on every rule + matching
 * confirmation + zxcvbn ≥ 3 (caps out after 4 ; we treat 1 as
 * effectively-zero strength while the rules aren't all met).
 *
 * On success the route forces a logout: change-password rotates the
 * envelope server-side, the local main-key material derived from
 * the OLD password is no longer authoritative for re-encrypting
 * data — the cleanest way to reset everything is to drop the
 * session and have the user re-login with the new password.
 *
 * Two-column shell mirrors Login / Register / Reset / Activate so
 * the auth surface stays one continuous design language.
 */
export default function ChangePasswordPage() {
  useDocumentTitle('Changer le mot de passe');
  const { t } = useI18n();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const navigate = useNavigate();
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
      setServerError('Session absente — reconnecte-toi.');
      return;
    }
    if (!rulesOk) {
      setServerError('Le mot de passe ne respecte pas toutes les règles.');
      return;
    }
    if ((strength?.score ?? 0) < 3) {
      setServerError('Mot de passe trop facile à deviner — essaie quelque chose de plus complexe.');
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

    // Force a logout + redirect. The server already revoked every
    // session in the change-password transaction ; passing the
    // redirect URL to `session.logout` lets it do the full
    // `location.replace` itself (CLAUDE.md crypto rule 7 : full
    // RAM purge), landing on /login with a marker so the page can
    // show the success banner.
    await session.logout('/login?password-changed=1').catch(() => undefined);
  }

  const newPasswordRegister = field('newPassword', {
    onChange: (e) => setNewPwd(e.target.value),
  });
  const confirmRegister = field('confirmPassword', {
    onChange: (e) => setConfirmPwd(e.target.value),
  });

  return (
    <AuthLayout
      headline="Renouvelle ta clé."
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mot de passe protège la clé qui chiffre tes données. Le changer
            rechiffre la clé localement — les données restent intactes.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le serveur ne voit jamais l’ancien ni le nouveau mot de passe : tout
            se passe sur ton appareil avant l’envoi.
          </p>
        </>
      }
    >
      <AuthPanelHeader eyebrow="Sécurité" title="Changer le mot de passe" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field
              label="Mot de passe actuel"
              type="password"
              autoComplete="current-password"
              required
              error={errors.currentPassword?.message}
              {...field('currentPassword')}
            />

            <Field
              label="Nouveau mot de passe"
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
              label="Confirmer le nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              required
              error={
                confirmMismatch
                  ? 'Les deux mots de passe ne correspondent pas.'
                  : errors.confirmPassword?.message
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
                isSubmitting ||
                !rulesOk ||
                confirmMismatch ||
                newPwd !== confirmPwd
              }
              className="mt-2 w-full"
            >
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour et se reconnecter'}
            </Button>

            <div className="mt-[18px] text-center text-[12.5px] text-muted">
              <Link
                to="/flow"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(-1);
                }}
                className="cursor-pointer transition-colors hover:text-ink"
              >
                ← Retour
              </Link>
            </div>
          </form>
    </AuthLayout>
  );
}


