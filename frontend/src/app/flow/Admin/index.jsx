import { useEffect, useState } from "react";
import pb from "@/core/api/pocketbase";
import UserTable from "./components/UserTable";
import InviteCodeManager from "./components/InviteCode";
import AnnouncementsManager from "./components/AnnouncementsManager";
import Subheader from "@/ui/layout/headers/Subheader";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [lastCode, setLastCode] = useState("");

  const user = pb.authStore.model;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function fetchUsers() {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("users").getFullList({
          sort: "email",
          $autoCancel: false,
        });
        if (!cancelled) {
          setUsers(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erreur chargement users: " + (err?.message || ""));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function fetchCodes() {
      try {
        const result = await pb.collection("invites_codes").getFullList({
          sort: "-created",
          $autoCancel: false,
        });
        if (!cancelled) {
          setInviteCodes(result);
        }
      } catch (err) {
        console.warn("[Admin] fetchCodes failed:", err);
      }
    }

    fetchCodes();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, generating, lastCode]);

  const handleDeleteInviteCode = async (codeId) => {
    try {
      await pb.collection("invites_codes").delete(codeId);
      setInviteCodes((prev) => prev.filter((code) => code.id !== codeId));
    } catch (err) {
      alert("Erreur suppression code : " + (err?.message || ""));
    }
  };

  const handleDelete = async (userId) => {
    const confirmed = window.confirm(
      "Supprimer cet utilisateur ? Toutes ses entrées journal seront aussi supprimées."
    );
    if (!confirmed) return;

    try {
      const journals = await pb.collection("mood_entries").getFullList({
        filter: `user="${userId}"`,
      });
      for (const entry of journals) {
        await pb.collection("mood_entries").delete(entry.id);
      }
      await pb.collection("users").delete(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Erreur suppression : " + (err?.message || ""));
    }
  };

  const handleResetPassword = async (targetUser) => {
    const email = targetUser.email;
    if (!window.confirm(`Envoyer un mail de reset à ${email} ?`)) return;
    try {
      await pb.collection("users").requestPasswordReset(email);
      alert("Mail de réinitialisation envoyé");
    } catch (err) {
      alert("Erreur reset : " + (err?.message || ""));
    }
  };

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
      const record = await pb.collection("invites_codes").create({ code });
      setLastCode(code);
      setInviteCodes((prev) => [record, ...prev]);
      setCopySuccess(`Code généré : ${code}`);
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
    } catch (err) {
      console.warn("[Admin] clipboard error:", err);
      setCopySuccess("Erreur lors de la copie");
    }
  };

  if (!isAdmin) {
    return <div className="p-8 text-red-500">Accès réservé aux admins.</div>;
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-500">Chargement...</div>;
  }
  if (error) {
    return <div className="py-12 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="h-full bg-slate-50">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6 flex flex-col gap-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Annonces</h2>
          <AnnouncementsManager />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Utilisateurs
          </h2>
          <UserTable
            users={users}
            onDelete={handleDelete}
            onResetPassword={handleResetPassword}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Codes d'invitation
          </h2>
          <InviteCodeManager
            inviteCodes={inviteCodes}
            generating={generating}
            onGenerate={handleGenerateCode}
            copySuccess={copySuccess}
            onCopy={handleCopy}
            onDelete={handleDeleteInviteCode}
          />
        </section>
      </div>
    </div>
  );
}
