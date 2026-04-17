import Modal from "@/ui/atoms/base/Modal";
import Button from "@/ui/atoms/base/Button";
// Modale bloquante, focus-trap, backdrop, fermeture uniquement via logout
export default function KeyMissingModal({ onLogout, open = true }) {
  return (
    <Modal
      open={open}
      disableClose
      backdropClass="bg-nodea-slate/40 backdrop-blur-xs"
      className="bg-white"
    >
      <h2 className="text-xl font-bold mb-4">Clé de chiffrement manquante</h2>
      <p className="mb-6">
        La clé de chiffrement n’est plus disponible
        <br />
        Merci de bien vouloir vous reconnecter
      </p>
      <Button variant="primary" className="px-6" onClick={onLogout} autoFocus>
        Se déconnecter
      </Button>
    </Modal>
  );
}
