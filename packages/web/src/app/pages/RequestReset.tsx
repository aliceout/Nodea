import { forwardRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequestPasswordReset, isApiError } from '@/core/api/client';
import { cn } from '@/lib/utils';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

/**
 * Request-reset — Direction K · Sauge.
 *
 * Mirrors `LoginPage`'s two-column shell (marketing aside left,
 * compact form right) so the auth surface stays one continuous
 * design language. The "Avant d'aller plus loin" warning keeps its
 * weight — losing the password loses the data — but it now reads in
 * the K palette instead of the legacy amber callout.
 *
 * The server always returns 200 to avoid enumeration (see the
 * `request-reset` handler), so the success view is identical
 * whether or not the email is in the database. The response itself
 * is our only confirmation the request went through.
 */
export default function RequestResetPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiRequestPasswordReset({ email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      if (isApiError(err) && err.status === 429) {
        setError('Trop de demandes récentes. Réessaie dans une heure.');
      } else {
        setError('Une erreur est survenue. Réessaie plus tard.');
        if (import.meta.env.DEV) console.warn('request-reset failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Récupère l’accès.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le mot de passe est aussi la clé qui chiffre tes entrées. Le
          réinitialiser efface les données existantes.
        </p>
      </AuthMarketingPanel>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          {sent ? <SentView email={email} /> : (
            <FormView
              email={email}
              onEmailChange={setEmail}
              onSubmit={onSubmit}
              submitting={submitting}
              error={error}
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface FormViewProps {
  email: string;
  onEmailChange: (next: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
}

function FormView({ email, onEmailChange, onSubmit, submitting, error }: FormViewProps) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Réinitialisation</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Mot de passe oublié
      </h2>
      <p className="mb-5 text-[13.5px] leading-[1.5] text-ink-soft">
        Indique ton email — on t’enverra un lien pour définir un nouveau mot de passe.
      </p>

      {/* Recovery code is the non-destructive alternative to the
          reset email — anyone who set one up at register / from
          Settings can recover their account WITHOUT losing data.
          Surfaced BEFORE the destructive form so users with a code
          don't even start typing here by reflex. Same green chrome
          (border-2 border-accent + bg-accent/5) as the
          `SidebarTipModules` info nudge — visually says "this is
          the safe path, take it". */}
      <div className="rounded-md border-2 border-accent bg-accent/5 px-3 py-2.5 text-[12.5px] text-ink-soft">
        <p className="mb-2 font-semibold text-accent-deep">
          Tu as un code de récupération&nbsp;?
        </p>
        {/* Render as an outline button rather than an inline link —
            "Récupérer sans perdre tes données" was reading as part
            of the prose otherwise, the green CTA-shaped affordance
            makes it unambiguous. */}
        <Link
          to="/recover"
          className="block w-full cursor-pointer rounded-md border border-accent bg-bg px-3 py-2 text-center text-[12.5px] font-semibold text-accent-deep transition-colors hover:bg-accent/10"
        >
          Récupérer sans perdre tes données →
        </Link>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-5">
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
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
          disabled={submitting || !email.trim()}
          className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-[11px] text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Envoi…' : 'M’envoyer le lien'}
        </button>

        {/* Hard warning BELOW the button — confirms what just got
            triggered + leaves the visual punchline as the last
            thing the user reads on the page. */}
        <div className="mt-3">
          <Warning title="Réinitialiser efface toutes tes données">
            Le chiffrement n’est pas réversible sans ton mot de passe d’origine.
          </Warning>
        </div>

        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            ← Retour à la connexion
          </Link>
        </div>
      </form>
    </>
  );
}

function SentView({ email }: { email: string }) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Lien envoyé</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Vérifie ta boîte mail
      </h2>
      <p className="mb-5 text-[13.5px] leading-[1.5] text-ink-soft">
        Si un compte Nodea est associé à <strong className="font-semibold text-ink">{email}</strong>,
        un email avec un lien de réinitialisation vient d’être envoyé. Le lien est valable 1 heure.
      </p>

      <Warning title="Le lien effacera toutes tes données">
        Confirme uniquement si tu acceptes une réinitialisation complète.
      </Warning>

      <div className="mt-5 text-center text-[12.5px] text-muted">
        <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
          ← Retour à la connexion
        </Link>
      </div>
    </>
  );
}

interface WarningProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Hard warning callout for the reset flow — uses the system danger
 * red (not the sauge-paired terracotta) because the consequence is
 * irreversible data loss. Title carries the punchline so it reads
 * at a glance; the body is one short sentence of context.
 */
function Warning({ title, children }: WarningProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger bg-danger/10 px-3.5 py-3 text-[12.5px] leading-[1.5] text-danger"
    >
      <p className="mb-1 flex items-center gap-1.5 font-semibold tracking-[0.01em]">
        <span aria-hidden="true">⚠</span>
        {title}
      </p>
      <p>{children}</p>
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
