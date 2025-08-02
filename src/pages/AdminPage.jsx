import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [lastCode, setLastCode] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("users").getFullList({
          sort: "email",
          $autoCancel: false,
        });
        setUsers(result);
      } catch (err) {
        setError("Erreur chargement users: " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const result = await pb.collection("invites_codes").getFullList({
          sort: "-created",
          $autoCancel: false,
        });
        setInviteCodes(result);
      } catch (err) {}
    };
    fetchCodes();
  }, [generating, lastCode]);

  // Nouvelle fonction pour suppression user + ses entrées journal
  const handleDelete = async (userId) => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? Toutes ses entrées journal seront aussi supprimées."
      )
    )
      return;
    try {
      // Récupère toutes les entrées journal de l'user
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${userId}"`,
      });
      // Supprime chaque entrée journal
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
      // Supprime l'user
      await pb.collection("users").delete(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Erreur suppression : " + (err?.message || ""));
    }
  };

  const handleResetPassword = async (user) => {
    const email = user.email;
    if (!window.confirm(`Envoyer un mail de reset à ${email} ?`)) return;
    try {
      await pb.collection("users").requestPasswordReset(email);
      alert("Mail de réinitialisation envoyé");
    } catch (err) {
      alert("Erreur reset : " + (err?.message || ""));
    }
  };

  // Génére un code random 8 caractères alphanumériques
  function randomCode(len = 8) {
    return Math.random()
      .toString(36)
      .replace(/[^a-z0-9]+/g, "")
      .slice(-len)
      .toUpperCase();
  }

  const handleGenerateCode = async () => {
    setGenerating(true);
    setCopySuccess("");
    const code = randomCode(8);
    try {
      // Si le champ s'appelle "code"
      const record = await pb.collection("invites_codes").create({ code });
      setLastCode(code);
      setInviteCodes([record, ...inviteCodes]);
      setCopySuccess("");
    } catch (err) {
      setCopySuccess("Erreur lors de la création du code");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(`Code copié : ${code}`);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {
      setCopySuccess("Erreur lors de la copie");
    }
  };

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mt-10 mb-6">
        Gestion des utilisateur·ices
      </h1>

      {/* Gérer les users */}
      <div className="rounded-lg overflow-hidden border border-gray-50">
        <table className="w-full table-auto">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left">Username</th>
              <th className="px-3 py-3 text-left">Rôle</th>
              <th className="px-3 py-3">Password</th>
              <th className="px-3 py-3">Supprimer</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                className={`${
                  i % 2 === 1 ? "bg-gray-50" : "bg-white"
                } hover:bg-blue-50`}
              >
                <td className="px-3 py-3 font-medium">{user.username}</td>
                <td className="px-3 py-3">{user.role}</td>
                <td className="px-3 py-3">
                  <button
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm"
                    onClick={() => handleResetPassword(user)}
                  >
                    Reset (mail)
                  </button>
                </td>
                <td className="px-3 py-3">
                  <button
                    className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 text-sm"
                    onClick={() => handleDelete(user.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Génération de codes d’invitation */}
      <div className="mt-8 px-12">
        <div className="flex gap-3 items-center justify-center">
          <button
            onClick={handleGenerateCode}
            className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
            disabled={generating}
          >
            {generating ? "Génération..." : "Générer un code d’invitation"}
          </button>
        </div>
        {copySuccess && (
          <div className="mt-2 text-green-600 font-medium">{copySuccess}</div>
        )}
        {inviteCodes.length > 0 && (
          <div className="mt-4">
            <div className="font-semibold mb-2">
              Codes d’invitation valides :
            </div>
            <ul className="flex flex-wrap gap-3">
              {inviteCodes.map((c) => (
                <li
                  key={c.id || c.code}
                  className="bg-gray-100 px-3 py-2 rounded flex items-center gap-2"
                >
                  <span className="font-mono">{c.code}</span>
                  <button
                    className="text-blue-700 text-xs hover:underline"
                    onClick={() => handleCopy(c.code)}
                  >
                    Copier
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
