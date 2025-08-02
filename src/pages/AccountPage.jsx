import React, { useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import { useNavigate } from "react-router-dom";

export default function AccountPage() {
  const user = pb.authStore.model;
  const [username, setUsername] = useState(user?.username || "");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const [pwResetSuccess, setPwResetSuccess] = useState("");
  const [pwResetError, setPwResetError] = useState("");

  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  // Username
  const handleUsername = async (e) => {
    e.preventDefault();
    setUsernameSuccess("");
    setUsernameError("");
    try {
      await pb.collection("users").update(user.id, { username });
      setUsernameSuccess("Nom d'utilisateur mis à jour");
    } catch (err) {
      setUsernameError("Erreur lors de la modification");
    }
  };

  // Email
  const handleEmail = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    if (!newEmail) {
      setEmailError("Renseigne un nouvel email");
      return;
    }
    try {
      await pb.collection("users").requestEmailChange(newEmail);
      setEmailSuccess(
        "Un email de confirmation a été envoyé, la session va être déconnecté·e. La reconnection avec la nouvelle adresse sera possibleaprès avoir valider le mail reçu "
      );
      setTimeout(() => {
        pb.authStore.clear();
        navigate("/login");
      }, 6000);

      setNewEmail("");
    } catch (err) {
      if (err.data?.email) {
        setEmailError("Cet email est déjà utilisé.");
      } else {
        setEmailError("Erreur lors de la demande");
      }
    }
  };

  // Reset mdp par mail
  const handlePasswordReset = async () => {
    setPwResetSuccess("");
    setPwResetError("");
    try {
      await pb.collection("users").requestPasswordReset(user.email);
      setPwResetSuccess("Mail de réinitialisation envoyé à " + user.email);
    } catch (err) {
      setPwResetError("Erreur lors de l’envoi du mail");
    }
  };

  // Suppression
  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte ?"
      )
    )
      return;
    try {
      // Récupérer toutes les entrées liées à l’utilisateur·ice
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
      });
      // Les supprimer une par une
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
      // Puis supprimer l'user
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch (err) {
      setDeleteError("Erreur lors de la suppression");
    }
  };

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-center mb-8">Mon compte</h1>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Colonne gauche */}
          <div className="flex-1 flex flex-col gap-8">
            {/* Username */}
            <section className="p-4 shadow bg-white rounded">
              <form onSubmit={handleUsername}>
                <label className="block mb-1 font-semibold">
                  Modifier le nom d'utilisateur
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full mb-2 p-2 border rounded"
                  required
                />
                {usernameSuccess && (
                  <div className="text-green-600">{usernameSuccess}</div>
                )}
                {usernameError && (
                  <div className="text-red-500">{usernameError}</div>
                )}
                <button
                  type="submit"
                  className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 mt-2"
                >
                  Modifier
                </button>
              </form>
            </section>
            {/* Reset mot de passe par mail */}
            <section className="p-4 shadow bg-white rounded flex flex-col">
              <label className="block mb-1 font-semibold">
                Réinitialiser le mot de passe par email
              </label>
              <button
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 w-full"
                onClick={handlePasswordReset}
                type="button"
              >
                Envoyer le mail de réinitialisation
              </button>
              {pwResetSuccess && (
                <div className="text-green-600 mt-2">{pwResetSuccess}</div>
              )}
              {pwResetError && (
                <div className="text-red-500 mt-2">{pwResetError}</div>
              )}
              <div className="text-gray-500 text-xs mt-2">
                Tu recevras un mail de réinitialisation à l’adresse actuelle.
              </div>
            </section>
          </div>
          {/* Colonne droite */}
          <div className="flex-1 flex flex-col gap-8">
            <section className="rounded p-4 shadow bg-white">
              <form onSubmit={handleEmail}>
                <label className="block mb-1 font-semibold">
                  Changer l'email
                </label>
                <input
                  type="email"
                  placeholder="Nouvel email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mb-2 p-2 border rounded"
                  required
                />
                {emailSuccess && (
                  <div className="text-green-600">{emailSuccess}</div>
                )}
                {emailError && <div className="text-red-500">{emailError}</div>}
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="submit"
                    className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 basis-4/10"
                  >
                    Modifier l'email
                  </button>
                  <span className="text-gray-500 text-xs basis-6/10 text-left ml-3">
                    Tu vas recevoir un mail de confirmation pour valider ce
                    changement.
                  </span>
                </div>
              </form>
            </section>

            {/* Suppression */}
            <section className="p-4 shadow bg-white rounded">
              <label className="block mb-1 font-semibold">
                Suppression du compte
              </label>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
                onClick={handleDelete}
              >
                Supprimer mon compte
              </button>
              {deleteError && (
                <div className="text-red-500 mt-2">{deleteError}</div>
              )}
              <div className="text-gray-500 text-xs mt-2">
                La suppression est définitive
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
