

import React from "react";
import Modal from "@/components/common//Modal";
import Button from "@/components/common/Button";
// Modale bloquante, focus-trap, backdrop, fermeture uniquement via logout
export default function KeyMissingModal({ onLogout, open = true }) {
  return (
    <Modal open={open} disableClose backdropClass="bg-nodea-slate/40 backdrop-blur-xs" className="bg-white">
      <h2 className="text-xl font-bold mb-4">Clé de chiffrement manquante</h2>
      <p className="mb-6">
        La clé de chiffrement n’est plus disponible<br />
        Merci de bien vouloir vous reconnecter
      </p>
      <Button
        className="bg-nodea-sage-dark text-white px-6 py-2 rounded font-semibold focus:outline-none focus:ring w-auto hover:bg-nodea-sage-darker"
        onClick={onLogout}
        autoFocus
      >
        Se déconnecter
      </Button>
    </Modal>
  );
}
