// src/modules/Settings/Account/PasswordReset.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function PasswordResetSection() {
  const navigate = useNavigate();
  const handleClick = () => navigate("/change-password");

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center rounded-md bg-nodea-sky-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sky-darker"
          >
            Changer mon mot de passe
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Ce bouton te permet de modifier ton mot de passe sans perdre l’accès à
          tes données chiffrées.
        </p>
      </div>
    </section>
  );
}
