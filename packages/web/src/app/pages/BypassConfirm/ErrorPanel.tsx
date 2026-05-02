import { Link } from 'react-router-dom';

export type ErrorReason =
  | 'cancelled'
  | 'consumed'
  | 'expired'
  | 'unknown'
  | 'network';

const ERROR_MESSAGES: Record<ErrorReason, { title: string; body: string }> = {
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

/**
 * One panel for every non-success status the api can return :
 * `cancelled`, `consumed`, `expired`, `unknown`, plus the
 * client-side `network` fallback (REFACTO-12 split). Each one
 * frames « what happened, what to do next » so the user lands on
 * a clear message rather than a generic 404.
 */
export default function ErrorPanel({ reason }: { reason: ErrorReason }) {
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
