import { useNavigate } from 'react-router-dom';
import Button from '@/ui/atoms/base/Button';
import AccountSettingsCard from '@/ui/atoms/specifics/AccountSettingsCard';

/**
 * "Password reset" is misnamed — there is no reset flow (the server has
 * no email). This card is just a shortcut to the full change-password
 * dance (old password → rewrap main key → new password).
 */
export default function PasswordResetSection() {
  const navigate = useNavigate();

  return (
    <AccountSettingsCard
      title="Changer le mot de passe"
      description="Modifier ton mot de passe sans perdre l'accès à tes données chiffrées."
    >
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <Button type="button" onClick={() => navigate('/change-password')} variant="info">
            Changer mot de passe
          </Button>
        </div>
      </form>
    </AccountSettingsCard>
  );
}
