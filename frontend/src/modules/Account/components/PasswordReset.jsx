// src/modules/Settings/Account/PasswordReset.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/common/SettingsCard";

export default function PasswordResetSection() {
  const navigate = useNavigate();
  const handleClick = () => navigate("/change-password");

  return (
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-gray-900 mb-1">
          Changer le mot de passe
        </div>
        <div className="text-sm text-gray-600">
          Ce bouton te permet de modifier ton mot de passe sans perdre l’accès à
          tes données chiffrées.
        </div>
      </div>
      <form className="w-full flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleClick}
            className=" bg-nodea-sky-dark hover:bg-nodea-sky-darker"
          >
            Changer mot de passe
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
