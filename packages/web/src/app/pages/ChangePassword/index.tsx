import { Link, useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import ChangePasswordForm from './ChangePasswordForm';

/**
 * Change-password page — Direction K · Sauge.
 *
 * Two-column shell mirrors Login / Register / Reset / Activate so
 * the auth surface stays one continuous design language.
 *
 * Split (REFACTO-12) :
 *   - `ChangePasswordForm.tsx` owns the RHF + zxcvbn UX and the
 *     submit-then-logout dance.
 *   - This file is the AuthLayout wrap + back link.
 */
export default function ChangePasswordPage() {
  useDocumentTitle('Changer le mot de passe');
  const navigate = useNavigate();

  return (
    <AuthLayout
      headline="Renouvelle ta clé."
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mot de passe protège la clé qui chiffre tes données. Le changer
            rechiffre la clé localement — les données restent intactes.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le serveur ne voit jamais l’ancien ni le nouveau mot de passe : tout
            se passe sur ton appareil avant l’envoi.
          </p>
        </>
      }
    >
      <AuthPanelHeader eyebrow="Sécurité" title="Changer le mot de passe" />

      <ChangePasswordForm />

      <div className="mt-[18px] text-center text-[12.5px] text-muted">
        <Link
          to="/flow"
          onClick={(e) => {
            e.preventDefault();
            navigate(-1);
          }}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour
        </Link>
      </div>
    </AuthLayout>
  );
}
