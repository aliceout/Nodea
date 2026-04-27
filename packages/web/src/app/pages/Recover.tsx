import { forwardRef, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { splitMnemonicForDisplay } from '@/core/crypto/bip39';
import { cn } from '@/lib/utils';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * `/recover` — non-destructive password recovery via BIP39 code
 * (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * Three stages:
 *   1. **Form**: email + 12 words + new password (typed twice).
 *   2. **Display new code**: the recover flow rotates the recovery
 *      code along with the password (the OLD code is invalidated
 *      server-side as soon as /finish runs), so we show a new
 *      mnemonic with the same 4×3 grid + ack pattern as
 *      `/recovery-code`.
 *   3. **Done**: redirect to `/flow/home` — the server has minted a
 *      fresh session cookie at /finish so the user lands signed in.
 *
 * Throughout: anti-enum on unknown emails, anti-enum on wrong
 * recovery code (both surface as a generic "code invalide" with no
 * differentiation in the UI).
 */
type Stage =
  | { kind: 'form' }
  | { kind: 'displaying'; mnemonic: string }
  | { kind: 'done' };

export default function RecoverPage() {
  const navigate = useNavigate();
  const session = useSession();

  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [email, setEmail] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
  const emailLooksValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    !submitting &&
    emailLooksValid &&
    wordCount === 12 &&
    rulesOk &&
    !confirmMismatch &&
    password === confirm &&
    (strength?.score ?? 0) >= 3;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const result = await session.recoverWithCode({
        email,
        mnemonic,
        newPassword: password,
      });
      setStage({ kind: 'displaying', mnemonic: result.mnemonic });
      // Wipe the entered values from React state once accepted.
      setMnemonic('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      // Bad mnemonic shape (validated client-side before any
      // server hit) AND server-side wrong-code AND unknown email
      // all surface here as the same "code invalide" message —
      // anti-enum requires not differentiating client-visibly.
      if (err instanceof Error && err.message === 'invalid_recovery_code') {
        setError('Code de récupération invalide.');
      } else if (isApiError(err) && err.status === 401) {
        setError('Code de récupération invalide.');
      } else if (isApiError(err) && err.status === 429) {
        setError('Trop de tentatives. Réessaie dans quelques minutes.');
      } else {
        setError('Une erreur est survenue. Réessaie plus tard.');
        if (import.meta.env.DEV) console.warn('recover failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone(): void {
    setStage({ kind: 'done' });
    navigate('/flow/home', { replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Récupère sans tout perdre.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Avec tes 12 mots, on peut redériver la clé qui chiffre tes données et
          la rechiffrer sous un nouveau mot de passe — sans toucher aux entrées
          existantes.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Tu repars avec un nouveau mot de passe et un nouveau code de
          récupération. L’ancien code est invalidé immédiatement.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[420px]">
          {stage.kind === 'form' ? (
            <FormPanel
              email={email}
              setEmail={setEmail}
              mnemonic={mnemonic}
              setMnemonic={setMnemonic}
              password={password}
              setPassword={setPassword}
              confirm={confirm}
              setConfirm={setConfirm}
              rules={rules}
              rulesOk={rulesOk}
              strength={strength}
              confirmMismatch={confirmMismatch}
              wordCount={wordCount}
              emailLooksValid={emailLooksValid}
              error={error}
              submitting={submitting}
              canSubmit={canSubmit}
              onSubmit={onSubmit}
            />
          ) : null}

          {stage.kind === 'displaying' ? (
            <DisplayPanel
              mnemonic={stage.mnemonic}
              acknowledged={acknowledged}
              setAcknowledged={setAcknowledged}
              onDone={handleDone}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

interface FormPanelProps {
  email: string;
  setEmail: (next: string) => void;
  mnemonic: string;
  setMnemonic: (next: string) => void;
  password: string;
  setPassword: (next: string) => void;
  confirm: string;
  setConfirm: (next: string) => void;
  rules: PasswordRulesCheck;
  rulesOk: boolean;
  strength: { score: number; warning: string | null } | null;
  confirmMismatch: boolean;
  wordCount: number;
  emailLooksValid: boolean;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

function FormPanel(props: FormPanelProps) {
  const {
    email,
    setEmail,
    mnemonic,
    setMnemonic,
    password,
    setPassword,
    confirm,
    setConfirm,
    rules,
    rulesOk,
    strength,
    confirmMismatch,
    wordCount,
    emailLooksValid,
    error,
    submitting,
    canSubmit,
    onSubmit,
  } = props;

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Récupération</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Récupérer avec un code
      </h2>
      <p className="mb-6 text-[14px] leading-[1.5] text-ink-soft">
        Tape ton e-mail, tes 12 mots de récupération, et un nouveau mot de passe.
        Tes données restent intactes.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          error={
            email && !emailLooksValid ? 'Format e-mail invalide.' : undefined
          }
        />

        <div className="mb-3.5">
          <label
            htmlFor="recover-mnemonic"
            className="mb-1.25 block text-[12px] font-medium text-muted"
          >
            12 mots de récupération
          </label>
          <textarea
            id="recover-mnemonic"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder="Sépare les mots par des espaces — la casse n’a pas d’importance."
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'w-full resize-none rounded-md border border-hair bg-bg px-3 py-2.5 font-mono text-[13px] text-ink',
              'outline-none transition-[border-color,box-shadow]',
              'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
            )}
          />
          <p className="mt-1 text-[11px] text-muted">
            {wordCount} / 12 mots
            {wordCount > 0 && wordCount !== 12
              ? ' — il en faut exactement 12.'
              : null}
          </p>
        </div>

        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <PasswordRulesList rules={rules} />
        {strength ? (
          <StrengthBar
            score={strength.score as 0 | 1 | 2 | 3 | 4}
            warning={strength.warning}
            rulesOk={rulesOk}
          />
        ) : null}

        <Field
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          error={
            confirmMismatch
              ? 'Les deux mots de passe ne correspondent pas.'
              : undefined
          }
        />

        {error ? (
          <div
            role="alert"
            className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Récupération…' : 'Récupérer mon compte'}
        </button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            ← Retour à la connexion
          </Link>
        </div>
      </form>
    </>
  );
}

/* ---- Mnemonic display + ack (mirrors RecoveryCode.tsx) ----------- */

interface DisplayPanelProps {
  mnemonic: string;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  onDone: () => void;
}

function DisplayPanel({
  mnemonic,
  acknowledged,
  setAcknowledged,
  onDone,
}: DisplayPanelProps) {
  const rows = splitMnemonicForDisplay(mnemonic);

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mnemonic);
    } catch {
      // Permission denied / insecure context — fall back to manual.
    }
  }

  function downloadAsTxt(): void {
    const blob = new Blob([mnemonic + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodea-recovery-code.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Récupération</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Compte récupéré ✓
      </h2>
      <p className="mb-4 text-[14px] leading-[1.5] text-ink-soft">
        Ton ancien code a été invalidé. Voici le nouveau, à noter
        immédiatement.
      </p>

      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">
          Ces 12 mots ne te seront jamais re-affichés. Recopie-les sur papier
          ou dans un gestionnaire de mots de passe.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-hair bg-bg-2 p-3">
        <ol className="grid grid-cols-3 gap-x-4 gap-y-2 text-[13px] tabular-nums">
          {rows.flat().map((word, i) => (
            <li key={i} className="flex items-baseline gap-2 font-mono">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              <span className="text-ink">{word}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={copyToClipboard}
          className="flex-1 cursor-pointer rounded-md border border-hair bg-bg px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-bg-2"
        >
          Copier
        </button>
        <button
          type="button"
          onClick={downloadAsTxt}
          className="flex-1 cursor-pointer rounded-md border border-hair bg-bg px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-bg-2"
        >
          Télécharger .txt
        </button>
      </div>

      <label className="mb-4 flex items-start gap-2 text-[12.5px] text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
        />
        <span>
          J’ai noté ces 12 mots et je les ai mis dans un endroit sûr.
        </span>
      </label>

      <button
        type="button"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        Aller à l’accueil
      </button>
    </>
  );
}

/* ---- Password feedback subcomponents (copied from Register.tsx) -- */

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
      <label htmlFor={inputId} className="mb-1.25 block text-[12px] font-medium text-muted">
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
