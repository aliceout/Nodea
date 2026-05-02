import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';

/**
 * Success panel : the bypass request has been confirmed by the
 * user clicking the email link, and the 7-day countdown is now
 * running. Shows a live countdown to the moment the bypass becomes
 * applicable on the next login (REFACTO-12 split).
 *
 * `alreadyConfirmed = true` means the link was clicked twice (or
 * the React strict-mode double-mount snuck through the latch) ;
 * the countdown still works but the copy explains the timer
 * started earlier.
 */
export default function SuccessPanel({
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
        Si ce n’est pas toi qui as déclenché cette demande, ferme cet onglet et{' '}
        <strong>reconnecte-toi normalement à Nodea</strong>. Une connexion
        réussie annule automatiquement le bypass, personne ne pourra contourner
        ton {factorLabel}.
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
 * Live countdown to the moment the bypass becomes applicable.
 *
 * Ticks at 1 Hz internally so the visible minute flips on time, but
 * the rendered text stays at minute precision — second-by-second
 * changes feel anxious. With a 7-day window we show « Jj HHh MMmin » ;
 * we drop the days segment once the remaining time is < 24 h so the
 * format degrades gracefully.
 *
 * Inline in this file (rather than a separate `Countdown.tsx`)
 * because `SuccessPanel` is the only consumer.
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
