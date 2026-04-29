import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import {
  PASSWORD_MIN_LENGTH,
  UsernameField,
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import {
  apiRegisterInviteInfo,
  apiRegisterMode,
  isApiError,
} from '@/core/api/client';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import PasswordRulesList from '@/ui/atoms/auth/PasswordRulesList';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Register — three modes (Auth-Roadmap Phase 1, post-rework v2):
 *
 *   - **Invited**   `?invite=<token>` in URL → server-issued email
 *                    pre-fills the form, locked to the invite. Submit
 *                    activates the account immediately and lands on
 *                    /login?activated=1.
 *   - **Open**      no token + admin toggle ON → free signup with
 *                    activation email + magic link.
 *   - **Closed**    no token + toggle OFF → "invitation only" panel,
 *                    no form.
 *
 * The mode is determined on mount via `apiRegisterMode()` +
 * `apiRegisterInviteInfo(token)`. While that's resolving we show a
 * neutral loading state; once settled we pick the right panel.
 */
type Mode =
  | { kind: 'loading' }
  | { kind: 'invited'; email: string; token: string }
  | { kind: 'invalid_invite'; token: string }
  | { kind: 'open' }
  | { kind: 'closed' };

export default function RegisterPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>({ kind: 'loading' });
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // Resolve mode on mount: if there's a token, validate it; otherwise
  // ask the server whether open registration is allowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = params.get('invite') ?? '';
      try {
        if (token) {
          const info = await apiRegisterInviteInfo(token);
          if (cancelled) return;
          if (info) {
            setMode({ kind: 'invited', email: info.email, token });
          } else {
            setMode({ kind: 'invalid_invite', token });
          }
        } else {
          const m = await apiRegisterMode();
          if (cancelled) return;
          setMode(m.openRegistration ? { kind: 'open' } : { kind: 'closed' });
        }
      } catch {
        if (!cancelled) setMode({ kind: 'closed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <AuthLayout headline="Crée ton espace." marketing={<PrivacyBody />}>
      {mode.kind === 'loading' ? <LoadingPanel /> : null}
      {mode.kind === 'closed' ? <ClosedPanel /> : null}
      {mode.kind === 'invalid_invite' ? <InvalidInvitePanel /> : null}

      {(mode.kind === 'invited' || mode.kind === 'open') &&
      submittedEmail === null ? (
        <RegisterForm
          mode={mode}
          onSubmitted={setSubmittedEmail}
          submitRegistration={session.submitRegistration}
        />
      ) : null}

      {submittedEmail !== null && mode.kind === 'open' ? (
        <CheckYourEmailCard email={submittedEmail} />
      ) : null}
      {submittedEmail !== null && mode.kind === 'invited' ? (
        <RedirectingToLoginCard email={submittedEmail} />
      ) : null}
    </AuthLayout>
  );
}

function LoadingPanel() {
  return <p className="text-[13px] text-muted">Chargement…</p>;
}

function ClosedPanel() {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Inscription"
        title="Sur invitation"
        subtitle={
          <>
            L'inscription à cette instance Nodea se fait sur invitation.
            Demande à un·e admin de t'envoyer un lien d'invitation par e-mail.
          </>
        }
      />

      <div className="mt-2 text-[12.5px] text-muted">
        <span>Déjà un compte&nbsp;?</span>{' '}
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          Se connecter
        </Link>
      </div>
    </>
  );
}

function InvalidInvitePanel() {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Inscription"
        title="Lien d'invitation invalide"
        subtitle={
          <>
            Ce lien d'invitation n'est pas valide. Il a peut-être déjà été utilisé,
            expiré, ou il a été tronqué pendant la copie.
          </>
        }
      />
      <p className="mb-6 text-[13px] text-muted">
        Demande à un·e admin de te renvoyer un nouveau lien.
      </p>

      <div className="mt-2 text-[12.5px] text-muted">
        <span>Déjà un compte&nbsp;?</span>{' '}
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          Se connecter
        </Link>
      </div>
    </>
  );
}

function CheckYourEmailCard({ email }: { email: string }) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Inscription"
        title="Vérifie ta boîte mail"
        subtitle={
          <>
            On a envoyé un lien d'activation à <strong>{email}</strong>. Clique sur le
            lien pour activer ton compte — tu pourras te connecter ensuite.
          </>
        }
      />
      <p className="mb-6 text-[12.5px] text-muted">
        Le lien est valable 7 jours. Pense à vérifier le dossier spam si tu ne le
        trouves pas tout de suite.
      </p>

      <div className="mt-2 text-[12.5px] text-muted">
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

/**
 * Shown briefly after an invited submit, before the navigate kicks in.
 * The invited path activates the account immediately so the user can
 * head straight to /login.
 */
function RedirectingToLoginCard({ email }: { email: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/login?activated=1', { replace: true }), 1200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <>
      <AuthPanelHeader
        eyebrow="Inscription"
        title="Compte créé !"
        subtitle={
          <>
            <strong>{email}</strong> est prêt. On te redirige vers la connexion.
          </>
        }
      />
    </>
  );
}

const RegisterFormSchema = z
  .object({
    username: UsernameField,
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirmPassword: z.string().min(1).max(200),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type RegisterForm = z.infer<typeof RegisterFormSchema>;

function RegisterForm({
  mode,
  onSubmitted,
  submitRegistration,
}: {
  mode: { kind: 'invited'; email: string; token: string } | { kind: 'open' };
  onSubmitted: (email: string) => void;
  submitRegistration: (input: {
    email: string;
    username: string;
    password: string;
    inviteToken?: string;
  }) => Promise<{ activated: boolean; email?: string }>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Open mode lets the user type their email; invited mode pre-fills
  // it from the invite (read-only, locked).
  const [emailInput, setEmailInput] = useState(
    mode.kind === 'invited' ? mode.email : '',
  );

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const emailLooksValid = /\S+@\S+\.\S+/.test(emailInput);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: RegisterForm): Promise<void> {
    setServerError(null);
    if (!rulesOk) {
      setServerError('Le mot de passe ne respecte pas toutes les règles.');
      return;
    }
    if (mode.kind === 'open' && !emailLooksValid) {
      setServerError('E-mail invalide.');
      return;
    }
    try {
      const input: {
        email: string;
        username: string;
        password: string;
        inviteToken?: string;
      } = {
        email: emailInput,
        username: values.username,
        password: values.password,
      };
      if (mode.kind === 'invited') input.inviteToken = mode.token;
      const result = await submitRegistration(input);
      onSubmitted(result.email ?? emailInput);
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 400 && err.error === 'weak_password') {
          setServerError(err.reason ?? 'Le mot de passe est trop faible.');
        } else if (err.status === 400 && err.reason === 'email_mismatch') {
          setServerError(
            'L\'e-mail ne correspond pas à celui de l\'invitation.',
          );
        } else if (err.status === 401) {
          setServerError(
            'Lien d\'invitation invalide ou déjà utilisé. Recharge la page pour vérifier.',
          );
        } else if (err.status === 403) {
          setServerError(
            'L\'inscription est fermée. Demande un lien d\'invitation à un·e admin.',
          );
        } else if (err.status === 429) {
          setServerError('Trop de tentatives. Réessaie dans quelques minutes.');
        } else {
          setServerError('Erreur lors de l\'inscription. Réessaie.');
        }
      } else {
        setServerError('Erreur réseau. Réessaie dans un instant.');
        if (import.meta.env.DEV) console.warn('register submit failed', err);
      }
    }
  }

  return (
    <>
      <AuthPanelHeader eyebrow="Inscription" title="Créer un compte" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={emailInput}
          readOnly={mode.kind === 'invited'}
          onChange={(e) =>
            mode.kind === 'open'
              ? setEmailInput(e.currentTarget.value)
              : undefined
          }
        />
        {mode.kind === 'invited' ? (
          <p className="-mt-2 mb-3.5 text-[11.5px] text-muted">
            E-mail défini lors de l'invitation, non modifiable.
          </p>
        ) : null}

        <Field
          label="Nom d'utilisateur·ice"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={
            errors.username?.message === 'invalid_username'
              ? 'Lettres, chiffres, et . _ - uniquement (2 à 32 caractères).'
              : errors.username?.message
          }
          {...field('username')}
        />
        <p className="-mt-2 mb-3.5 text-[11.5px] text-muted">
          Un prénom ou un pseudo, comme tu préfères.
        </p>

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
            password !== confirm ||
            (mode.kind === 'open' && !emailLooksValid)
          }
          className="mt-2 w-full"
        >
          {isSubmitting ? 'Envoi…' : 'Créer mon compte'}
        </Button>

        {/*
         * "Déjà un compte ? Se connecter" only makes sense in the open
         * registration path. Invited users got here from an email link;
         * they're being onboarded onto THIS instance specifically and
         * don't have an account on it yet (the admin route enforces
         * `user_already_exists` 409 before sending the invite). Showing
         * a "log in" detour here would distract them from completing
         * their inscription.
         */}
        {mode.kind === 'open' ? (
          <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
            <span>Déjà un compte&nbsp;?</span>
            <Link
              to="/login"
              className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
            >
              Se connecter
            </Link>
          </div>
        ) : null}
      </form>
    </>
  );
}
