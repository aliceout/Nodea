import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiMfaBypassConfirm } from '@/core/api/client';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';

/**
 * BypassConfirm — landing page for the MFA bypass confirm email
 * link (Auth-Roadmap Phase 6).
 *
 * The email link points at `/auth/bypass/confirm?t=<token>`. On
 * mount we hit the API; on success we surface a live HH:MM countdown
 * to `earliestApplyAt` (now + 7 days). Other server statuses
 * (`already_confirmed`, `cancelled`, `consumed`, `expired`,
 * `unknown`) each get their own panel — the user gets a clear "what
 * happened, what to do next" message rather than a 404.
 *
 * The double-mount latch mirrors `Activate.tsx`: React 19 strict
 * mode runs effects twice in dev, and the first call would already
 * flip `confirmed_at`, making the second see `already_confirmed`.
 */
type Status =
  | { state: 'pending' }
  | {
      state: 'success';
      factor: 'totp' | 'passkey';
      earliestApplyAt: Date;
      /** True when the request was already confirmed before this
       *  click — UI nudges the user that the timer started earlier. */
      alreadyConfirmed: boolean;
    }
  | {
      state: 'error';
      reason: 'cancelled' | 'consumed' | 'expired' | 'unknown' | 'network';
    };

export default function BypassConfirmPage() {
  useDocumentTitle('Confirmation MFA');
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
        const res = await apiMfaBypassConfirm(token);
        if (res.status === 'ok' || res.status === 'already_confirmed') {
          setStatus({
            state: 'success',
            factor: res.factor,
            earliestApplyAt: new Date(res.earliestApplyAt),
            alreadyConfirmed: res.status === 'already_confirmed',
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
    <AuthLayout
      headline="Récupération MFA."
      maxWidth="400"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Quelqu’un a demandé à se connecter sans un de tes facteurs 2FA
            (TOTP ou passkey). Toi, on espère.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une fois confirmé, le compteur 7 jours démarre. Cette latence te
            laisse le temps de réagir si ce n’est pas toi qui as déclenché la
            demande — il suffit de te reconnecter normalement à Nodea pour
            que la demande soit annulée.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Au prochain login après le délai, le facteur sera retiré et tu
            pourras te reconnecter.
          </p>
        </>
      }
    >
      {status.state === 'pending' ? <PendingPanel /> : null}
      {status.state === 'success' ? (
        <SuccessPanel
          factor={status.factor}
          earliestApplyAt={status.earliestApplyAt}
          alreadyConfirmed={status.alreadyConfirmed}
        />
      ) : null}
      {status.state === 'error' ? (
        <ErrorPanel reason={status.reason} />
      ) : null}
    </AuthLayout>
  );
}

function PendingPanel() {
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">
        Validation en cours…
      </h2>
      <p className="text-[13px] text-muted">
        On vérifie ton lien de récupération, deux secondes.
      </p>
    </div>
  );
}

function SuccessPanel({
  factor,
  earliestApplyAt,
  alreadyConfirmed,
}: {
  factor: 'totp' | 'passkey';
  earliestApplyAt: Date;
  alreadyConfirmed: boolean;
}) {
  const factorLabel = factor === 'totp' ? 'TOTP' : 'passkey';
  const sideEffect =
    factor === 'totp'
      ? 'Ton TOTP sera désactivé et tes codes de secours invalidés.'
      : 'Toutes tes passkeys seront supprimées — tu pourras en réenrôler après.';

  return (
    <div>
      <AuthPanelHeader
        eyebrow={<>Récupération {factorLabel}</>}
        title={alreadyConfirmed ? 'Demande déjà confirmée' : 'Demande validée'}
        subtitle={
          alreadyConfirmed
            ? `Tu avais déjà cliqué le lien — le compteur 7 jours tourne déjà depuis. Tu pourras te reconnecter sans ${factorLabel} dès que le compteur atteint zéro.`
            : `Tu pourras te reconnecter sans ${factorLabel} dans 7 jours. ${sideEffect}`
        }
      />

      <Countdown target={earliestApplyAt} />

      <p className="mt-6 text-[12.5px] leading-[1.5] text-muted">
        Si ce n’est pas toi qui as déclenché cette demande, ferme cet onglet
        et <strong>reconnecte-toi normalement à Nodea</strong>. Une connexion
        réussie annule automatiquement le bypass, personne ne pourra
        contourner ton {factorLabel}.
      </p>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-muted">
        Si tu suspectes que ton compte est compromis, change ton mot de passe
        depuis Compte → Sécurité.
      </p>

      <div className="mt-6 text-center text-[12.5px] text-muted">
        <Link
          to="/login"
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

/**
 * Live countdown showing the time remaining until the bypass
 * becomes applicable. Ticks at 1 Hz internally so the visible
 * minute flips on time, but the rendered text stays at minute
 * precision — second-by-second changes feel anxious. With a 7-day
 * window we show "Jj HHh MMmin"; we drop the days segment once the
 * remaining time is < 24h so the format degrades gracefully.
 */
function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = target.getTime() - now.getTime();
  const expired = remainingMs <= 0;

  if (expired) {
    return (
      <div className="rounded-md border border-accent bg-accent/5 px-4 py-4 text-center">
        <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-accent-deep">
          Délai écoulé
        </p>
        <p className="text-[14px] text-ink-soft">
          Tu peux te reconnecter dès maintenant — le bypass s’appliquera au
          prochain login.
        </p>
      </div>
    );
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  const targetText = target.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-md border border-hair bg-bg-soft px-4 py-4 text-center">
      <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted">
        Reconnexion possible dans
      </p>
      <p className="font-mono text-[28px] font-semibold tracking-[0.02em] text-ink tabular-nums">
        {days > 0 ? (
          <>
            {days}
            <span className="px-1 text-muted">j</span>
          </>
        ) : null}
        {String(hours).padStart(2, '0')}
        <span className="px-1 text-muted">h</span>
        {String(minutes).padStart(2, '0')}
        <span className="pl-1 text-muted">min</span>
      </p>
      <p className="mt-2 text-[12px] text-muted">le {targetText}</p>
    </div>
  );
}

const ERROR_MESSAGES: Record<
  Exclude<Extract<Status, { state: 'error' }>['reason'], never>,
  { title: string; body: string }
> = {
  cancelled: {
    title: 'Demande annulée',
    body: 'Cette demande de récupération a déjà été annulée. Si tu veux à nouveau récupérer ton facteur perdu, relance une demande depuis la page de connexion.',
  },
  consumed: {
    title: 'Demande déjà appliquée',
    body: 'Cette demande a été appliquée à un login précédent. Ton facteur a déjà été retiré ; reconnecte-toi normalement.',
  },
  expired: {
    title: 'Demande expirée',
    body: 'Cette demande a expiré (les liens sont valables 7 jours). Relance une demande depuis la page de connexion.',
  },
  unknown: {
    title: 'Lien invalide',
    body: 'Ce lien de confirmation n’est pas reconnu. Il a peut-être été tronqué pendant la copie. Relance une demande depuis la page de connexion.',
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
