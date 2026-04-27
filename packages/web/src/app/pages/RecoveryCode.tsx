import { forwardRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { splitMnemonicForDisplay } from '@/core/crypto/bip39';
import { cn } from '@/lib/utils';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

/**
 * Settings → Recovery code KEK (Auth-Roadmap Phase 3, Auth-Spec
 * §7.7).
 *
 * One page, two modes:
 *   - **Setup** (recoveryCodeSet === false): the user types their
 *     current password, we generate a fresh BIP39 mnemonic, wrap
 *     their KEK under it, persist server-side. Mnemonic shown once.
 *   - **Regenerate** (recoveryCodeSet === true): same flow, the
 *     server replaces the previous wrap blobs + hash.
 *
 * Both paths require the OPAQUE password proof — see
 * `useSession.setupRecoveryCode` for the orchestration.
 *
 * The mnemonic is shown ONCE in a 4×3 grid with copy / download
 * buttons; the user must check "j'ai noté ce code" before the
 * "Terminé" button appears. After confirmation we navigate to
 * `/flow/home` — the sidebar warning disappears as soon as `/me`
 * surfaces `recoveryCodeSet: true`.
 */
type Stage =
  | { kind: 'form' }
  | { kind: 'displaying'; mnemonic: string; regenerated: boolean }
  | { kind: 'done' };

export default function RecoveryCodePage() {
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const isRegenerate = user?.recoveryCodeSet === true;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await session.setupRecoveryCode(password);
      setStage({
        kind: 'displaying',
        mnemonic: result.mnemonic,
        regenerated: result.regenerated,
      });
      setPassword('');
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe incorrect.');
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError('Mot de passe incorrect.');
      } else if (isApiError(err) && err.status === 429) {
        setError('Trop de tentatives. Réessaie dans quelques minutes.');
      } else {
        setError('Erreur lors de la configuration. Réessaie.');
        if (import.meta.env.DEV) console.warn('recovery-code setup failed', err);
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
      <AuthMarketingPanel headline="Un filet de sécurité, sans backdoor.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le code de récupération est un mot de passe de secours, sous forme de 12
          mots simples à recopier. Il dérive une clé qui chiffre la même clé
          maître que ton mot de passe.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Si tu oublies ton mot de passe, ces 12 mots te permettent de récupérer
          ton compte sans perdre tes données. Sans eux, le seul recours est de
          tout effacer.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[420px]">
          {stage.kind === 'form' ? (
            <FormPanel
              isRegenerate={isRegenerate}
              password={password}
              setPassword={setPassword}
              error={error}
              submitting={submitting}
              onSubmit={onSubmit}
            />
          ) : null}

          {stage.kind === 'displaying' ? (
            <DisplayPanel
              mnemonic={stage.mnemonic}
              regenerated={stage.regenerated}
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
  isRegenerate: boolean;
  password: string;
  setPassword: (next: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

function FormPanel({
  isRegenerate,
  password,
  setPassword,
  error,
  submitting,
  onSubmit,
}: FormPanelProps) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Sécurité</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {isRegenerate
          ? 'Régénérer le code de récupération'
          : 'Configurer un code de récupération'}
      </h2>
      <p className="mb-6 text-[14px] leading-[1.5] text-ink-soft">
        {isRegenerate
          ? 'Génère un nouveau code de 12 mots. L’ancien sera invalidé immédiatement — assure-toi de pouvoir noter le nouveau avant de continuer.'
          : 'On va générer 12 mots à noter. Tape ton mot de passe pour autoriser la génération.'}
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
          disabled={submitting || !password}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Génération…' : isRegenerate ? 'Régénérer' : 'Générer mes 12 mots'}
        </button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link
            to="/flow/home"
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Retour
          </Link>
        </div>
      </form>
    </>
  );
}

interface DisplayPanelProps {
  mnemonic: string;
  regenerated: boolean;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  onDone: () => void;
}

function DisplayPanel({
  mnemonic,
  regenerated,
  acknowledged,
  setAcknowledged,
  onDone,
}: DisplayPanelProps) {
  const rows = splitMnemonicForDisplay(mnemonic);

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mnemonic);
    } catch {
      // Browsers without clipboard permission (or insecure context)
      // — silently fail. The user can transcribe by hand from the
      // visible grid.
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
      <p className="mb-1 text-[13px] text-muted">Sécurité</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {regenerated ? 'Nouveau code généré' : 'Ton code de récupération'}
      </h2>

      {/* Same K · Sauge danger tone as Reset.tsx — the message is
          weighty + the action below is destructive-by-omission
          (closing the page without writing the words down means the
          code is gone for good). */}
      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">
          Ces 12 mots ne te seront jamais re-affichés. Recopie-les sur papier ou
          dans un gestionnaire de mots de passe — sans eux, oublier ton mot de
          passe = perte de toutes tes données.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-hair bg-bg-2 p-3">
        <ol className="grid grid-cols-3 gap-x-4 gap-y-2 text-[13px] tabular-nums">
          {rows.flat().map((word, i) => (
            <li
              key={i}
              className="flex items-baseline gap-2 font-mono"
            >
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
        className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        Terminé
      </button>
    </>
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
