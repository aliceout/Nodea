import React from "react";
import { useNavigate } from "react-router-dom";

export default function PasswordResetSection() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/change-password");
  };

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Changer le mot de passe en toute sécurité
      </label>
      <button
        className="bg-amber-400 text-white px-4 py-2 rounded hover:bg-amber-500 w-full"
        onClick={handleClick}
        type="button"
      >
        Changer mon mot de passe
      </button>
      <div className="text-gray-500 text-xs mt-2">
        Ce bouton te permet de modifier ton mot de passe sans perdre l'accès à
        tes données chiffrées.
      </div>
    </section>
  );
}
