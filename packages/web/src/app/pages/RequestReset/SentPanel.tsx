import { Link } from 'react-router-dom';

import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import Warning from './Warning';

/**
 * Confirmation view shown after a successful POST to
 * `/auth/request-reset` (REFACTO-12 split).
 *
 * The server always returns 200 to avoid enumeration — this view
 * is identical whether or not the email is in the database, hence
 * the « si un compte est associé » phrasing.
 */
export default function SentPanel({ email }: { email: string }) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Lien envoyé"
        title="Vérifie ta boîte mail"
        subtitle={
          <>
            Si un compte Nodea est associé à{' '}
            <strong className="font-semibold text-ink">{email}</strong>, un email
            avec un lien de réinitialisation vient d’être envoyé. Le lien est
            valable 1 heure.
          </>
        }
      />

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
