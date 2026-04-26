import { forwardRef, useEffect, useMemo, useState } from 'react';
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
import {
  RegisterStartBodySchema,
  VerifyEmailBodySchema,
  type VerifyEmailErrorReason,
} from '@nodea/shared/schemas/auth-register-v2';
import { useSession } from '@/core/auth/use-session';
import {
  apiRegisterStart,
  apiRegisterState,
  apiVerifyEmail,
  isApiError,
} from '@/core/api/client';
import { cn } from '@/lib/utils';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Register — multi-step wizard (Auth-Roadmap Phase 1C).
 *
 * Replaces the legacy single-shot `RegisterPage`. Three steps:
 *
 *   1. `email` + `inviteCode` → POST /auth/register/start. Server emails
 *      a 6-digit code and creates a `pre_register` users row.
 *   2. `code` → POST /auth/register/verify-email. Server transitions
 *      the row to `email_verified` and emits the register session
 *      cookie.
 *   3. `password` (+ confirm, with rules + zxcvbn). Calls the bridge
 *      route `/auth/register/set-password` (replaced by OPAQUE in
 *      Phase 2), which UPDATEs the user with the real crypto envelope
 *      and promotes the register session to a full session.
 *
 * Resume: `apiRegisterState()` runs once on mount. If the cookie is
 *   live we jump directly to the relevant step (typically step 3 if
 *   `email_verified`, step 2 if somehow still in `pre_register`).
 *
 * The legacy `apiRegister` single-shot stays in `client.ts` for
 * back-compat (admin tooling, seed scripts) — this page no longer
 * uses it.
 */
type WizardStep = 'loading' | 'start' | 'verify' | 'password';

interface ResumeContext {
  email: string;
}

export default function RegisterPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('loading');
  /**
   * The wizard remembers the email + invite across steps. The email
   * also doubles as the proof of "the user typed something at step 1"
   * — step 2 won't accept a verify-email submission without it.
   */
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [resumeFromState, setResumeFromState] = useState<ResumeContext | null>(null);

  // Resume probe — runs once on mount. The register cookie is only
  // emitted at the END of step 2 (verify-email success), so a present
  // cookie always means `registerState >= 'email_verified'` → resume
  // lands on step 3. Step 2 is never the resume target in V1; later
  // phases that introduce intermediate states (Phase 2+: password_set,
  // recovery_set, …) revisit this mapping.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await apiRegisterState();
        if (cancelled) return;
        if (!state) {
          setStep('start');
          return;
        }
        setEmail(state.email);
        setResumeFromState({ email: state.email });
        setStep('password');
      } catch {
        if (!cancelled) setStep('start');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function goToVerify(nextEmail: string, nextInviteCode: string): void {
    setEmail(nextEmail);
    setInviteCode(nextInviteCode);
    setStep('verify');
  }

  function goToPassword(): void {
    setStep('password');
  }

  function startOver(): void {
    setEmail('');
    setInviteCode('');
    setResumeFromState(null);
    setStep('start');
  }

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

      {/* Form panel — content varies per step. */}
      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          {step === 'loading' ? (
            <p className="text-[13px] text-muted">Chargement…</p>
          ) : null}

          {step === 'start' ? (
            <StartStep onSent={goToVerify} />
          ) : null}

          {step === 'verify' ? (
            <VerifyStep
              email={email}
              onVerified={goToPassword}
              onStartOver={startOver}
            />
          ) : null}

          {step === 'password' ? (
            <PasswordStep
              email={email}
              inviteCode={inviteCode}
              isResume={Boolean(resumeFromState)}
              onSuccess={() => navigate('/flow/home', { replace: true })}
              completeRegister={session.completeRegister}
              onStartOver={startOver}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ---- Step 1 — email + invite code ------------------------------- */

const StartFormSchema = RegisterStartBodySchema;
type StartForm = z.infer<typeof StartFormSchema>;

function StartStep({
  onSent,
}: {
  onSent: (email: string, inviteCode: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StartForm>({
    resolver: zodResolver(StartFormSchema),
    defaultValues: { email: '', inviteCode: '' },
  });

  async function onSubmit(values: StartForm): Promise<void> {
    setServerError(null);
    try {
      await apiRegisterStart({
        email: values.email,
        inviteCode: values.inviteCode,
      });
      onSent(values.email, values.inviteCode);
    } catch (err) {
      // The server returns 200 even for invalid invites (anti-enum), so
      // the only failures we see here are network / 5xx / 429.
      if (isApiError(err) && err.status === 429) {
        setServerError(
          'Trop de tentatives. Réessaye dans quelques minutes.',
        );
      } else {
        setServerError('Erreur lors de l’envoi du code. Réessaye dans un instant.');
        if (import.meta.env.DEV) console.warn('register/start failed', err);
      }
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Étape 1 sur 3</p>
      <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Démarrer l’inscription
      </h2>
      <p className="mb-6 text-[13px] text-muted">
        On t’envoie un code à 6 chiffres pour vérifier ton adresse.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...field('email')}
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
          disabled={isSubmitting}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-[11px] text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Envoi…' : 'Envoyer le code'}
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

/* ---- Step 2 — verify email code --------------------------------- */

const VerifyFormSchema = VerifyEmailBodySchema.pick({ code: true });
type VerifyForm = z.infer<typeof VerifyFormSchema>;

const VERIFY_REASON_MESSAGES: Record<VerifyEmailErrorReason, string> = {
  invalid_body: 'Code invalide. Six chiffres attendus.',
  no_pending_verification:
    'Aucune demande active pour cette adresse. Recommence à l’étape 1.',
  expired:
    'Le code a expiré. Recommence à l’étape 1 pour en recevoir un nouveau.',
  too_many_attempts:
    'Trop de tentatives. Recommence à l’étape 1 pour repartir avec un nouveau code.',
  invalid_code: 'Code incorrect. Vérifie tes 6 chiffres et réessaie.',
};

function VerifyStep({
  email,
  onVerified,
  onStartOver,
}: {
  email: string;
  onVerified: () => void;
  onStartOver: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyForm>({
    resolver: zodResolver(VerifyFormSchema),
    defaultValues: { code: '' },
  });

  async function onSubmit(values: VerifyForm): Promise<void> {
    setServerError(null);
    try {
      await apiVerifyEmail({ email, code: values.code });
      onVerified();
    } catch (err) {
      if (isApiError(err)) {
        const reason = err.reason as VerifyEmailErrorReason | undefined;
        const message =
          reason && reason in VERIFY_REASON_MESSAGES
            ? VERIFY_REASON_MESSAGES[reason]
            : 'La vérification a échoué. Réessaie.';
        setServerError(message);
      } else {
        setServerError('Erreur réseau. Réessaie dans un instant.');
        if (import.meta.env.DEV) console.warn('register/verify-email failed', err);
      }
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Étape 2 sur 3</p>
      <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Vérifier ton adresse
      </h2>
      <p className="mb-6 text-[13px] text-muted">
        On a envoyé un code à 6 chiffres à <strong>{email}</strong>. Il expire dans 10
        minutes.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Code à 6 chiffres"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={errors.code?.message}
          {...field('code')}
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
          disabled={isSubmitting}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-[11px] text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Vérification…' : 'Valider le code'}
        </button>

        <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onStartOver}
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            Recommencer
          </button>
        </div>
      </form>
    </>
  );
}

/* ---- Step 3 — set password ------------------------------------- */

const PasswordFormSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirmPassword: z.string().min(1).max(200),
    inviteCode: z.string().min(1).max(128),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type PasswordForm = z.infer<typeof PasswordFormSchema>;

function PasswordStep({
  email,
  inviteCode,
  isResume,
  onSuccess,
  completeRegister,
  onStartOver,
}: {
  email: string;
  inviteCode: string;
  isResume: boolean;
  onSuccess: () => void;
  completeRegister: (input: { password: string; inviteCode: string }) => Promise<void>;
  onStartOver: () => void;
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
  } = useForm<PasswordForm>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { password: '', confirmPassword: '', inviteCode },
  });

  async function onSubmit(values: PasswordForm): Promise<void> {
    setServerError(null);
    if (!rulesOk) {
      setServerError('Le mot de passe ne respecte pas toutes les règles.');
      return;
    }
    try {
      await completeRegister({
        password: values.password,
        inviteCode: values.inviteCode,
      });
      onSuccess();
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 400 && err.reason === 'invalid_invite') {
          setServerError(
            'Le code d’invitation n’est plus valide. Recommence depuis l’étape 1.',
          );
        } else if (err.status === 400 && err.error === 'weak_password') {
          setServerError(
            err.reason ?? 'Le mot de passe est trop faible.',
          );
        } else if (err.status === 409) {
          setServerError(
            'L’inscription est dans un état inattendu. Recommence depuis le début.',
          );
        } else {
          setServerError('Erreur lors de la finalisation. Réessaie.');
        }
      } else {
        setServerError('Erreur réseau. Réessaie dans un instant.');
        if (import.meta.env.DEV) console.warn('register/set-password failed', err);
      }
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Étape 3 sur 3</p>
      <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Choisir ton mot de passe
      </h2>
      <p className="mb-6 text-[13px] text-muted">
        {isResume ? (
          <>
            Tu finalises l’inscription de <strong>{email}</strong>. Choisis un mot de
            passe — toutes tes données seront chiffrées avec lui.
          </>
        ) : (
          <>
            Choisis un mot de passe pour <strong>{email}</strong>. Toutes tes données
            seront chiffrées avec lui. Si tu le perds, elles sont irrécupérables.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

        {/* Invite code is kept hidden — already entered at step 1.
            We send it back to the server for atomic consumption.
            On resume (refresh between step 2 and 3), we ask the user
            to re-supply it since wizard state is lost. */}
        {isResume ? (
          <Field
            label="Code d’invitation"
            type="text"
            autoComplete="one-time-code"
            error={errors.inviteCode?.message}
            {...field('inviteCode')}
          />
        ) : (
          <input type="hidden" {...field('inviteCode')} />
        )}

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
          {isSubmitting ? 'Finalisation…' : 'Créer mon compte'}
        </button>

        <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onStartOver}
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            Recommencer
          </button>
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
