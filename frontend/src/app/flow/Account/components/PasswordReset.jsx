import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/ui/atoms/base/Button";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard.jsx";

export default function PasswordResetSection() {
  const navigate = useNavigate();
  const handleClick = () => navigate("/change-password");

  return (
    <AccountSettingsCard
      title="Changer le mot de passe"
      description="Ce bouton te permet de modifier ton mot de passe sans perdre l’accès à tes données chiffrées."
    >
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleClick}
            variant="info"
          >
            Changer mot de passe
          </Button>
        </div>
      </form>
    </AccountSettingsCard>
  );
}
