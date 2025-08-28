import React from "react";

// Modale bloquante, focus-trap, backdrop, fermeture uniquement via logout
export default function KeyMissingModal({ onLogout }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-nodea-slate-light/30 via-grey/5 to-nodea-sage/10 backdrop-blur-xs">
      <div
        className="bg-white/40 rounded-lg shadow-lg p-8 max-w-md w-full text-center"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <h2 className="text-xl font-bold mb-4">Clé de chiffrement manquante</h2>
        <p className="mb-6">
          La clé de chiffrement n’est plus disponible.
          <br />
          Déconnecte-toi puis reconnecte-toi.
        </p>
        <button
          className="bg-nodea-sky-dark text-white px-6 py-2 rounded font-semibold focus:outline-none focus:ring"
          onClick={onLogout}
          autoFocus
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
