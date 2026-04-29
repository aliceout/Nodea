import { Link } from 'react-router-dom';

import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';

/** Surface shown when the user lands on `/reset` without a
 *  `?token=…` query param (or with a malformed one). The token
 *  arrives via the recovery email ; if it's missing the user
 *  needs to redo the « j'ai perdu mon mot de passe » flow. */
export default function InvalidLinkPanel() {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Lien invalide"
        title="Ce lien est incomplet."
        subtitle="Redemande un email depuis la page « mot de passe oublié »."
      />
      <Link
        to="/request-reset"
        className="inline-block rounded-md bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Redemander un lien
      </Link>
    </>
  );
}
