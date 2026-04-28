import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequestPasswordReset, isApiError } from '@/core/api/client';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

/**
 * Request-reset — Direction K · Sauge.
 *
 * Three-stage page:
 *
 *   1. **Fork** — entry point from `/login`'s "mot de passe oublié"
 *      link. Two big choices: "j'ai un code de récupération" vs
 *      "j'ai pas de code". Most users with a code shouldn't even
 *      see the destructive form; the fork keeps the colorful
 *      destructive warning out of the default layout.
 *   2. **Destroy** — the existing email-input form, reached when
 *      the user clicks "j'ai pas de code". This is where the data-
 *      loss warning lives.
 *   3. **Sent** — confirmation view after a successful POST.
 *
 * The server always returns 200 to avoid enumeration (see the
 * `request-reset` handler), so the success view is identical
 * whether or not the email is in the database.
 */
type Stage = 'fork' | 'destroy' | 'sent';

export default function RequestResetPage() {
  const [stage, setStage] = useState<Stage>('fork');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiRequestPasswordReset({ email: email.trim().toLowerCase() });
      setStage('sent');
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
          {stage === 'fork' ? (
            <ForkView onNoCode={() => setStage('destroy')} />
          ) : null}
          {stage === 'destroy' ? (
            <FormView
              email={email}
              onEmailChange={setEmail}
              onSubmit={onSubmit}
              submitting={submitting}
              error={error}
              onBack={() => setStage('fork')}
            />
          ) : null}
          {stage === 'sent' ? <SentView email={email} /> : null}
        </div>
      </main>
    </div>
  );
}

interface ForkViewProps {
  onNoCode: () => void;
}

/**
 * Entry-point fork: ask whether the user has a recovery code.
 * Two equally-weighted buttons; the "j'ai un code" button is the
 * non-destructive path (so primary visual weight) while "j'ai pas
 * de code" leads into the destructive form (secondary weight).
 */
function ForkView({ onNoCode }: ForkViewProps) {
  const navigate = useNavigate();
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Récupération</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Mot de passe oublié
      </h2>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        As-tu un code de récupération&nbsp;?
      </p>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={() => navigate('/recover')}
        className="w-full"
      >
        J’ai un code de récupération
      </Button>

      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        onClick={onNoCode}
        className="mt-2 w-full"
      >
        Je n’ai pas de code
      </Button>

      <div className="mt-[18px] text-center text-[12.5px] text-muted">
        <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
          ← Retour à la connexion
        </Link>
      </div>
    </>
  );
}

interface FormViewProps {
  email: string;
  onEmailChange: (next: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
}

function FormView({
  email,
  onEmailChange,
  onSubmit,
  submitting,
  error,
  onBack,
}: FormViewProps) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Réinitialisation</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Réinitialiser sans code
      </h2>
      <p className="mb-5 text-[13.5px] leading-[1.5] text-ink-soft">
        Indique ton email — on t’enverra un lien pour définir un nouveau mot
        de passe.
      </p>

      {/* Hard data-loss warning — the user chose the destructive
          path on the fork, but we still want the consequence
          framed before the form. Same red Warning callout that
          predated the entry-fork refactor. */}
      <Warning title="Tes données seront effacées">
        Le chiffrement n’est pas réversible sans ton mot de passe d’origine.
      </Warning>

      <form onSubmit={onSubmit} noValidate className="mt-5">
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="danger-outline"
          size="lg"
          disabled={submitting || !email.trim()}
          className="mt-2 w-full"
        >
          {submitting ? 'Envoi…' : 'M’envoyer le lien'}
        </Button>

        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Retour
          </button>
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

