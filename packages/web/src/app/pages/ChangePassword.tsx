import { forwardRef, useMemo, useState } from 'react';
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
  type PasswordRulesCheck,
} from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

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
      if (isApiError(err) && err.status === 401) {
        setServerError('Mot de passe actuel incorrect.');
      } else if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Nouveau mot de passe refusé.');
      } else {
        setServerError('Erreur lors du changement de mot de passe.');
        if (import.meta.env.DEV) console.warn('change-password failed', err);
      }
      return;
    }

    // Force a logout + redirect to /login. The server already
    // revoked every session in the change-password transaction;
    // we drop the in-memory main-key material here too so the UI
    // can't keep operating on stale state. The redirect lands on
    // /login with a marker so the page can show a friendly notice.
    await session.logout().catch(() => undefined);
    navigate('/login?password-changed=1', { replace: true });
  }

  const newPasswordRegister = field('newPassword', {
    onChange: (e) => setNewPwd(e.target.value),
  });
  const confirmRegister = field('confirmPassword', {
    onChange: (e) => setConfirmPwd(e.target.value),
  });

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Renouvelle ta clé.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le mot de passe protège la clé qui chiffre tes données. Le changer
          rechiffre la clé localement — les données restent intactes.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le serveur ne voit jamais l’ancien ni le nouveau mot de passe : tout
          se passe sur ton appareil avant l’envoi.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          <p className="mb-1 text-[13px] text-muted">Sécurité</p>
          <h2 className="mb-7 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            Changer le mot de passe
          </h2>

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
              <div
                role="alert"
                className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
              >
                {serverError}
              </div>
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
                to="/flow/account"
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
        </div>
      </main>
    </div>
  );
}

/* ---- Password feedback subcomponents (mirrored from Register.tsx) -- */

interface PasswordRulesListProps {
  rules: PasswordRulesCheck;
}

const RULE_LABELS: Array<{ key: keyof PasswordRulesCheck; label: string }> = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH} caractères minimum` },
  { key: 'lowercase', label: 'une minuscule' },
  { key: 'uppercase', label: 'une majuscule' },
  { key: 'digit', label: 'un chiffre' },
  { key: 'special', label: 'un caractère spécial' },
];

function PasswordRulesList({ rules }: PasswordRulesListProps) {
  return (
    <ul className="-mt-2 mb-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px]">
      {RULE_LABELS.map(({ key, label }) => {
        const ok = rules[key];
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-1.5',
              ok ? 'text-accent-deep' : 'text-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-block h-3 w-3 shrink-0 rounded-full text-center text-[9px] leading-3 transition-colors',
                ok ? 'bg-accent text-white' : 'border border-hair bg-bg',
              )}
            >
              {ok ? '✓' : ''}
            </span>
            {label}
          </li>
        );
      })}
    </ul>
  );
}

interface StrengthBarProps {
  score: 0 | 1 | 2 | 3 | 4;
  warning: string | null;
  rulesOk: boolean;
}

function StrengthBar({ score: rawScore, warning, rulesOk }: StrengthBarProps) {
  const score: 0 | 1 | 2 | 3 | 4 = rulesOk
    ? rawScore
    : rawScore > 1
      ? 1
      : rawScore;

  const bandTone = (i: number): string => {
    if (i > score) return 'bg-hair';
    if (score <= 1) return 'bg-low';
    if (score === 2) return 'bg-low-soft';
    if (score === 3) return 'bg-accent-soft';
    return 'bg-accent';
  };
  const label =
    score <= 1
      ? 'Trop faible'
      : score === 2
        ? 'Moyen'
        : score === 3
          ? 'Solide'
          : 'Très solide';

  return (
    <div className="-mt-2 mb-3">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn('h-1 flex-1 rounded-full transition-colors', bandTone(i))}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Force&nbsp;: <span className="font-medium text-ink-soft">{label}</span>
        {warning ? <span className="text-low-deep"> — {warning}</span> : null}
      </p>
    </div>
  );
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string | undefined;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, className, id, name, ...rest },
  ref,
) {
  const inputId = id ?? `field-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <div className="mb-3.5">
      <label htmlFor={inputId} className="mb-[5px] block text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-md border border-hair bg-bg px-3 py-2.5 text-[14px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
