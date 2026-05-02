import { Link, useNavigate } from 'react-router-dom';

import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/**
 * Entry-point fork (REFACTO-12 split) : ask whether the user has
 * a recovery code. Two equally-weighted buttons ; the « j'ai un
 * code » button is the non-destructive path (so primary visual
 * weight) while « j'ai pas de code » leads into the destructive
 * form (secondary weight).
 *
 * Most users with a code shouldn't even see the destructive form —
 * the fork keeps the colorful destructive warning out of the
 * default layout.
 */
export default function ForkPanel({ onNoCode }: { onNoCode: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <AuthPanelHeader
        eyebrow="Récupération"
        title="Mot de passe oublié"
        subtitle={<>As-tu un code de récupération&nbsp;?</>}
      />

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
