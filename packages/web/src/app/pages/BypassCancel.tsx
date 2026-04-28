import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiMfaBypassCancel } from '@/core/api/client';
import AuthMarketingPanel, { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';

/**
 * BypassCancel — landing page for the MFA bypass cancel email link
 * (Auth-Roadmap Phase 6).
 *
 * Mirrors `BypassConfirm` but for the "this wasn't me, kill the
 * request" path. Calls the API on mount and renders an outcome
 * panel. No countdown — cancellation is immediate.
 *
 * Same double-mount latch as `Activate.tsx` to survive React 19
 * strict-mode dev double-effect runs.
 */
type Status =
  | { state: 'pending' }
  | {
      state: 'success';
      factor: 'totp' | 'passkey';
      alreadyCancelled: boolean;
    }
  | { state: 'error'; reason: 'consumed' | 'unknown' | 'network' };

export default function BypassCancelPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>({ state: 'pending' });
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = params.get('t') ?? '';
    if (!token) {
      setStatus({ state: 'error', reason: 'unknown' });
      return;
    }

    (async () => {
      try {
        const res = await apiMfaBypassCancel(token);
        if (res.status === 'ok' || res.status === 'already_cancelled') {
          setStatus({
            state: 'success',
            factor: res.factor,
            alreadyCancelled: res.status === 'already_cancelled',
          });
        } else {
          setStatus({ state: 'error', reason: res.status });
        }
      } catch {
        setStatus({ state: 'error', reason: 'network' });
      }
    })();
  }, [params]);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Récupération MFA.">
        <PrivacyBody />
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[400px]">
          {status.state === 'pending' ? <PendingPanel /> : null}
          {status.state === 'success' ? (
            <SuccessPanel
              factor={status.factor}
              alreadyCancelled={status.alreadyCancelled}
            />
          ) : null}
          {status.state === 'error' ? (
            <ErrorPanel reason={status.reason} />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function PendingPanel() {
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">
        Annulation en cours…
      </h2>
      <p className="text-[13px] text-muted">
        On invalide la demande de récupération.
      </p>
    </div>
  );
}

function SuccessPanel({
  factor,
  alreadyCancelled,
}: {
  factor: 'totp' | 'passkey';
  alreadyCancelled: boolean;
}) {
  const factorLabel = factor === 'totp' ? 'TOTP' : 'passkey';
  return (
    <div>
      <p className="mb-1 text-[13px] text-muted">Récupération {factorLabel}</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {alreadyCancelled ? 'Demande déjà annulée' : 'Demande annulée'}
      </h2>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        {alreadyCancelled
          ? `Cette demande avait déjà été annulée. Tu peux te reconnecter normalement avec ton ${factorLabel}.`
          : `La demande de récupération est invalidée. Personne ne pourra contourner ton ${factorLabel} avec ce lien — tu peux te reconnecter normalement.`}
      </p>

      <p className="mb-6 text-[12.5px] leading-[1.5] text-muted">
        Si tu suspectes que ton compte est compromis, va sur la page de
        connexion et utilise <strong>« Mot de passe oublié → reset
        destructif »</strong> — c’est le seul recours qui invalide tout
        l’accès.
      </p>

      <div className="text-center">
        <Link
          to="/login"
          className="inline-block rounded-md bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Aller à la connexion
        </Link>
      </div>
    </div>
  );
}

const ERROR_MESSAGES: Record<
  Exclude<Extract<Status, { state: 'error' }>['reason'], never>,
  { title: string; body: string }
> = {
  consumed: {
    title: 'Trop tard',
    body: 'Cette demande a déjà été appliquée à un login précédent — il est trop tard pour l’annuler. Si ce n’est pas toi qui as déclenché ça, va sur la page de connexion et utilise « reset destructif » pour invalider l’accès.',
  },
  unknown: {
    title: 'Lien invalide',
    body: 'Ce lien d’annulation n’est pas reconnu. Il a peut-être été tronqué pendant la copie.',
  },
  network: {
    title: 'Erreur réseau',
    body: 'On n’a pas pu joindre le serveur. Vérifie ta connexion et réessaie.',
  },
};

function ErrorPanel({
  reason,
}: {
  reason: Extract<Status, { state: 'error' }>['reason'];
}) {
  const msg = ERROR_MESSAGES[reason];
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">{msg.title}</h2>
      <p className="mb-6 text-[14px] text-ink-soft">{msg.body}</p>
      <Link
        to="/login"
        className="inline-block rounded-md bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Aller à la connexion
      </Link>
    </div>
  );
}
