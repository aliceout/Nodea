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
import { cn } from '@/lib/utils';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Register — Direction K · Sauge.
 *
 * Mirrors `LoginPage`'s two-column shell (marketing aside on
 * `bg-bg-2` left, compact form on `bg-bg` right) so the auth flow
 * feels like one continuous surface. Form schema stays form-only —
 * `useSession.register()` builds the real `RegisterBody` (email +
 * password + invite + encryption envelope) by wrapping a freshly
 * derived main key before POSTing.
 *
 * Password UX:
 *   - live rules tracker (12 chars, lower/upper/digit/special) sourced
 *     from the shared `checkPasswordRules` helper so the client and
 *     `checkPasswordPolicy` server-side reject the same shapes.
 *   - 5-band zxcvbn strength bar that mirrors the Mood note tone scale
 *     (sauge for solid, terracotta for weak).
 *   - confirm-password field; mismatched passwords short-circuit
 *     submission with an inline alert.
 *   - submit is blocked until every rule is green AND the two password
 *     fields match.
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
  const navigate = useNavigate();
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
      await session.register({
        email: values.email,
        password: values.password,
        inviteCode: values.inviteCode,
      });
      // Client-side nav so the freshly derived main key survives.
      // See the matching comment in `Login.tsx` for the security
      // rationale.
      navigate('/flow/home', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Échec de l’inscription.');
      } else {
        setServerError('Erreur lors de l’inscription. Réessayez.');
        if (import.meta.env.DEV) console.warn('register failed', err);
      }
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      {/* Marketing panel */}
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
              {isSubmitting ? 'Inscription…' : 'Créer le compte'}
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
        </div>
      </main>
    </div>
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

/**
 * 5-band strength bar mirroring zxcvbn's score (0..4). Bands beyond
 * the active score stay neutral; active bands tint with the same
 * sauge / terracotta scale Mood uses for note tones, so "très solide"
 * reads as "good vibes" without spelling it out chromatically.
 *
 * The displayed score is **clamped to 1 ("Trop faible")** until every
 * rule is met — zxcvbn rates raw entropy and would happily call a long
 * lowercase-only password "Très solide", contradicting the rules
 * checklist sitting right above. We let zxcvbn push the score *down*
 * even when the rules are green (for things like `Password1!Password1!`
 * that pass every rule yet stay guessable), but we never let it push
 * the score *up* past the rules gate.
 */
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
