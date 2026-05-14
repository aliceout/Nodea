import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/** Pre-form spinner — surfaced while the registration mode
 *  (`closed` / `invited` / `open`) is being resolved against
 *  the server. Plain text by design : the form below it loads
 *  fast enough that a fancy skeleton would feel like overkill. */
export function LoadingPanel() {
  return <p className="text-[13px] text-muted">Chargement…</p>;
}

/** Surface shown when registration is closed on this instance.
 *  No inline link to request an invite — invites are admin-side
 *  only ; the message tells the user to contact one. */
export function ClosedPanel() {
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

/** Surface shown when the `?token=…` invite code on the URL
 *  fails to validate (used, expired, or truncated during the
 *  copy). Invites the user to ask for a new link. */
export function InvalidInvitePanel() {
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

/** Confirmation screen after a successful **open** registration.
 *  Open mode requires email verification — a 7-day-valid link
 *  is sent ; the user activates from there before being able to
 *  log in. */
export function CheckYourEmailCard({ email }: { email: string }) {
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
 * Confirmation screen after a successful **invited** submit. The
 * invited path activates the account immediately so the user
 * can head straight to /login — we just show this card briefly
 * then auto-navigate after 1.2s.
 */
export function RedirectingToLoginCard({ email }: { email: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/login?activated=1', { replace: true }), 1200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <AuthPanelHeader
      eyebrow="Inscription"
      title="Compte créé !"
      subtitle={
        <>
          <strong>{email}</strong> est prêt. On te redirige vers la connexion.
        </>
      }
    />
  );
}
