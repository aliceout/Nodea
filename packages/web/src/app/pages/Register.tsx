import { forwardRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { cn } from '@/lib/utils';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Register — single-step inscription with magic-link activation
 * (Auth-Roadmap Phase 1 reworked).
 *
 * Flow:
 *   1. User fills the form (email, password, confirm, invite).
 *   2. Submit → POST /auth/register → server creates inactive user
 *      and emails an activation link.
 *   3. UI swaps to a "Check your email" confirmation card. The user
 *      clicks the link in their email, which lands them on
 *      `/activate?token=…` (handled by `Activate.tsx`).
 *   4. After successful activation they're redirected to /login
 *      with a success banner and can sign in normally.
 *
 * No cookie is set during the inscription. The legacy
 * `useSession.register()` (single-shot, set cookie + cache main key
 * immediately) was removed — the only persistence between submit and
 * login is the email magic link.
 */
const RegisterFormSchema = z
  .object({
    email: z.string().email().max(254),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirmPassword: z.string().min(1).max(200),
    inviteCode: z.string().min(1).max(128),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type RegisterForm = z.infer<typeof RegisterFormSchema>;

export default function RegisterPage() {
  const session = useSession();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      {/* Marketing panel — same shell as Login. */}
      <aside className="hidden flex-col justify-between border-r border-hair bg-bg-2 px-[72px] py-16 lg:flex">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Nodea</span>
        </div>

        <div className="animate-fade-up">
          <h1 className="mb-[18px] text-[56px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            Crée ton espace.
          </h1>
          <p className="max-w-[460px] text-[18px] leading-[1.5] text-ink-soft">
            Un espace privé, hébergé par toi. Mood, journal, passages, goals, habits, library,
            review — chiffrés bout en bout, jamais visibles côté serveur.
          </p>
        </div>

        <div className="flex gap-3.5 text-[12px] text-muted">
          <span>Chiffré bout en bout</span>
          <span>·</span>
          <span>Auto-hébergé</span>
          <span>·</span>
          <span>AGPL-3.0</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          {submittedEmail ? (
            <CheckYourEmailCard email={submittedEmail} />
          ) : (
            <RegisterForm
              onSubmitted={setSubmittedEmail}
              submitRegistration={session.submitRegistration}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function RegisterForm({
  onSubmitted,
  submitRegistration,
}: {
  onSubmitted: (email: string) => void;
  submitRegistration: (input: {
    email: string;
    password: string;
    inviteCode: string;
  }) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', inviteCode: '' },
  });

  async function onSubmit(values: RegisterForm): Promise<void> {
    setServerError(null);
    if (!rulesOk) {
      setServerError('Le mot de passe ne respecte pas toutes les règles.');
      return;
    }
    try {
      await submitRegistration({
        email: values.email,
        password: values.password,
        inviteCode: values.inviteCode,
      });
      onSubmitted(values.email);
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 400 && err.error === 'weak_password') {
          setServerError(err.reason ?? 'Le mot de passe est trop faible.');
        } else if (err.status === 400) {
          setServerError('Données invalides. Vérifie ton e-mail et ton code.');
        } else if (err.status === 429) {
          setServerError('Trop de tentatives. Réessaie dans quelques minutes.');
        } else {
          setServerError('Erreur lors de l’inscription. Réessaie.');
        }
      } else {
        setServerError('Erreur réseau. Réessaie dans un instant.');
        if (import.meta.env.DEV) console.warn('register submit failed', err);
      }
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Inscription</p>
      <h2 className="mb-7 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Créer un compte
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...field('email')}
        />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...field('password', {
            onChange: (e) => setPassword(e.target.value),
          })}
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
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={
            confirmMismatch
              ? 'Les deux mots de passe ne correspondent pas.'
              : errors.confirmPassword?.message
          }
          {...field('confirmPassword', {
            onChange: (e) => setConfirm(e.target.value),
          })}
        />

        <Field
          label="Code d’invitation"
          type="text"
          autoComplete="one-time-code"
          error={errors.inviteCode?.message}
          {...field('inviteCode')}
        />

        {serverError ? (
          <div
            role="alert"
            className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
          >
            {serverError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !rulesOk || confirmMismatch || password !== confirm}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-[11px] text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Envoi…' : 'Créer mon compte'}
        </button>

        <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
          <span>Déjà un compte&nbsp;?</span>
          <Link
            to="/login"
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </form>
    </>
  );
}

/**
 * Confirmation card shown after a successful submit. The actual
 * account is created server-side but is INACTIVE until the user
 * clicks the link in the email. We deliberately don't auto-redirect —
 * the user needs to context-switch to their inbox, and a static
 * panel makes that affordance obvious.
 */
function CheckYourEmailCard({ email }: { email: string }) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Inscription</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Vérifie ta boîte mail
      </h2>
      <p className="mb-4 text-[14px] leading-[1.5] text-ink-soft">
        On a envoyé un lien d’activation à <strong>{email}</strong>. Clique sur le
        lien pour activer ton compte — tu pourras te connecter ensuite.
      </p>
      <p className="mb-6 text-[12.5px] text-muted">
        Le lien est valable 7 jours. Pense à vérifier le dossier spam si tu ne le
        trouves pas tout de suite.
      </p>

      <div className="mt-2 flex items-center justify-between text-[12.5px] text-muted">
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          Aller à la page de connexion
        </Link>
      </div>
    </>
  );
}

/* ---- Password feedback subcomponents --------------------------- */

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
