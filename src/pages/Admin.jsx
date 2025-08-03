import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import UserTable from "../components/Admin/UserTable";
import InviteCodeManager from "../components/Admin/InviteCode";

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

  // Suppression user + ses entrées journal
  const handleDelete = async (userId) => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? Toutes ses entrées journal seront aussi supprimées."
      )
    )
      return;
    try {
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${userId}"`,
      });
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
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

  // Code d'invitation
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
        Gestion des utilisateur·ice·s
      </h1>
      <UserTable
        users={users}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
      />
      <InviteCodeManager
        inviteCodes={inviteCodes}
        generating={generating}
        onGenerate={handleGenerateCode}
        copySuccess={copySuccess}
        onCopy={handleCopy}
      />
    </Layout>
  );
}
