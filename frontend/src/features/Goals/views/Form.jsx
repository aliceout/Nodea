// frontend/src/features/Goals/views/Form.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// 🔐 Clé principale depuis le store global (bytes attendus, pas CryptoKey)
import { useStore } from "@/core/store/StoreProvider";
// ⚙️ Récupération du module_user_id comme dans Passage/Mood
import { useModulesRuntime } from "@/core/store/modulesRuntime";

import Button from "@/ui/atoms/base/Button";
import Input from "@/ui/atoms/form/Input";
import Textarea from "@/ui/atoms/form/Textarea";
import Select from "@/ui/atoms/form/Select";
import SuggestInput from "@/ui/atoms/form/SuggestInput";
import FormError from "@/ui/atoms/form/FormError";
import DateMonthPicker from "@/ui/atoms/form/DateMonthPicker";

import {
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from "@/core/api/modules/Goals";

export default function GoalsForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { mainKey } = useStore();
  const modules = useModulesRuntime();
  const moduleUserId =
    modules?.goals?.id || modules?.goals?.module_user_id || "";

  const [tags, setTags] = useState([]); // options pour SuggestInput (si tu renseignes)
  const [thread, setThread] = useState(""); // valeur sélectionnée (info UX, non stockée ici)

  const isEdit = useMemo(() => Boolean(id), [id]);

  const [loading, setLoading] = useState(isEdit);
  const [initialEntry, setInitialEntry] = useState(null);
  const [form, setForm] = useState({
    date: "",
    title: "",
    note: "",
    status: "done",
  });
  const [error, setError] = useState("");

  // Charger l'entrée si édition
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!isEdit) {
        if (mounted) setLoading(false);
        return;
      }
      // On attend la mainKey + le sid comme sur Passage
      if (!mainKey || !moduleUserId) return;

      try {
        const entry = await getGoalById(moduleUserId, mainKey, id);
        if (!mounted) return;
        setInitialEntry(entry);
        setForm({
          date: entry.date || "",
          title: entry.title || "",
          note: entry.note || "",
          status: entry.status || "done",
        });
        setThread(entry.thread || "");
      } catch (e) {
        console.error(e);
        setError("Impossible de charger l’objectif.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isEdit, id, mainKey, moduleUserId]);

  const onChange = (key) => (e) => {
    setForm((s) => ({ ...s, [key]: e.target.value }));
  };

  const validate = () => {
    if (!form.title.trim()) return "Le titre est requis.";
    if (!["open", "wip", "done"].includes(form.status))
      return "Statut invalide.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    // Gardes-fous
    if (!mainKey) {
      setError(
        "Erreur : clé de chiffrement absente. Recharge la page ou reconnecte-toi, puis réessaie."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Goals' non configuré (id manquant).");
      return;
    }

    const payload = {
      date: form.date || "",
      title: form.title.trim(),
      note: form.note || "",
      status: form.status,
      thread,
    };

    try {
      if (isEdit) {
        await updateGoal(moduleUserId, mainKey, id, initialEntry, payload);
      } else {
        await createGoal(moduleUserId, mainKey, payload);
      }
      navigate("..");
    } catch (e2) {
      console.error(e2);
      setError("Échec de l’enregistrement.");
    }
  };
  const handleDelete = async () => {
    if (!isEdit) return;
    setError("");

    if (!mainKey) {
      setError(
        "Erreur : clé de chiffrement absente. Recharge la page ou reconnecte-toi."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Goals' non configuré (id manquant).");
      return;
    }

    try {
      await deleteGoal(moduleUserId, mainKey, id, initialEntry);
      navigate("..");
    } catch (e) {
      console.error(e);
      setError("Échec de la suppression.");
    }
  };

  // Affiche le form même si ça charge : on désactive juste les actions.
  const disabled = (isEdit && loading) || !moduleUserId;

  return (
    <form
      className="grid grid-cols-1 gap-4 max-w-2xl mx-auto"
      onSubmit={handleSubmit}
    >
      <h1 className="text-2xl font-bold">
        {isEdit ? "Modifier l’objectif" : "Nouvelle entrée"}
      </h1>

      {error ? <FormError message={error} /> : null}

      <Input
        label="Titre"
        type="text"
        value={form.title}
        onChange={onChange("title")}
        placeholder="Ex. Lancer un blog"
        required
        disabled={disabled}
      />

      <div className="flex justify-between gap-4 flex-col lg:flex-row">
        <DateMonthPicker
          label="Date"
          value={form.date}
          onChange={onChange("date")}
          disabled={disabled}
          className="lg:w-1/2"
          legend={
            <>
              Choisis le mois et l'année (ex. <i>2025-09</i>).
            </>
          }
        />
        <Select
          label="Statut"
          value={form.status}
          onChange={onChange("status")}
          disabled={disabled}
          className="lg:w-1/2"
        >
          <option value="open">Ouvert</option>
          <option value="wip">En cours</option>
          <option value="done">Terminé</option>
        </Select>
      </div>

      <SuggestInput
        label="Hashtag / histoire"
        placeholder="ex: #SortieJob ou #Deuil…"
        value={thread}
        onChange={setThread}
        options={tags}
        legend="Choisis un hashtag existant ou crée-en un nouveau. Il sert à regrouper les entrées."
      />

      <Textarea
        label="Note"
        value={form.note}
        onChange={onChange("note")}
        inputClassName="min-h-[120px]"
        placeholder="Détails éventuels…"
        disabled={disabled}
      />

      <Button
        className="bg-nodea-sage-dark hover:bg-nodea-sage-darker"
        type="submit"
        disabled={disabled}
      >
        {isEdit ? (loading ? "Chargement…" : "Mettre à jour") : "Enregistrer"}
      </Button>

      {isEdit ? (
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={disabled}
        >
          Supprimer
        </Button>
      ) : null}
    </form>
  );
}
