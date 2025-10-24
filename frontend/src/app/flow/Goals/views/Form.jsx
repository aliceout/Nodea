// frontend/src/features/Goals/views/Form.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

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
  listDistinctThreads,
} from "@/core/api/modules/Goals";

const STATUS_VALUES = ["open", "wip", "done"];

export default function GoalsForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { mainKey, markMissing } = useStore();
  const modules = useModulesRuntime();
  const moduleUserId =
    modules?.goals?.id || modules?.goals?.module_user_id || "";

  const [tags, setTags] = useState([]);
  const [thread, setThread] = useState("");

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

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!isEdit) {
        if (mounted) setLoading(false);
        return;
      }
      if (!hasMainKeyMaterial(mainKey) || !moduleUserId) return;

      try {
        const entry = await getGoalById(moduleUserId, mainKey, id, {
          markMissing,
        });
        if (!mounted) return;
        setInitialEntry(entry);
        setForm({
          date: entry.date || "",
          title: entry.title || "",
          note: entry.note || "",
          status: entry.status || "done",
        });
        setThread(entry.thread || "");
        const normalizedThread = (entry.thread || "").trim();
        if (normalizedThread) {
          setTags((prev) =>
            prev.includes(normalizedThread)
              ? prev
              : [...prev, normalizedThread]
          );
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError("Impossible de charger l'objectif.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id, isEdit, mainKey, moduleUserId, markMissing]);

  useEffect(() => {
    let cancelled = false;

    async function loadTags() {
      if (!hasMainKeyMaterial(mainKey) || !moduleUserId) return;
      try {
        const list = await listDistinctThreads(moduleUserId, mainKey, {
          markMissing,
        });
        if (!cancelled) setTags(list);
      } catch (err) {
        console.warn("[GoalsForm] listDistinctThreads failed", err);
        if (!cancelled) setTags([]);
      }
    }

    loadTags();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, markMissing]);

  const onChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const validate = () => {
    if (!form.title.trim()) return "Le titre est requis.";
    if (!STATUS_VALUES.includes(form.status)) return "Statut invalide.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!hasMainKeyMaterial(mainKey)) {
      setError(
        "Erreur : cle de chiffrement absente. Recharge la page ou reconnecte-toi."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Goals' non configure (id manquant).");
      return;
    }

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const payload = {
      date: form.date || "",
      title: form.title.trim(),
      note: form.note,
      status: form.status,
      thread: thread.trim(),
    };

    try {
      if (isEdit) {
        await updateGoal(moduleUserId, mainKey, id, initialEntry, payload);
      } else {
        await createGoal(moduleUserId, mainKey, payload);
      }
      navigate("..");
    } catch (err) {
      console.error(err);
      setError("Echec de l'enregistrement.");
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    setError("");

    if (!hasMainKeyMaterial(mainKey)) {
      setError(
        "Erreur : cle de chiffrement absente. Recharge la page ou reconnecte-toi."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Goals' non configure (id manquant).");
      return;
    }

    try {
      await deleteGoal(moduleUserId, mainKey, id, initialEntry);
      navigate("..");
    } catch (err) {
      console.error(err);
      setError("Echec de la suppression.");
    }
  };

  const disabled =
    (isEdit && loading) || !moduleUserId || !hasMainKeyMaterial(mainKey);

  return (
    <form
      className="grid grid-cols-1 gap-4 max-w-2xl mx-auto"
      onSubmit={handleSubmit}
    >
      <h1 className="text-2xl font-bold">
        {isEdit ? "Modifier l'objectif" : "Nouvelle entree"}
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
              Choisis le mois et l'annee (ex. <i>2025-09</i>).
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
          <option value="done">Termine</option>
        </Select>
      </div>

      <SuggestInput
        label="Hashtag / histoire"
        placeholder="ex: #SortieJob ou #Deuil"
        value={thread}
        onChange={setThread}
        options={tags}
        legend="Choisis un hashtag existant ou cree-en un nouveau. Il sert a regrouper les entrees."
      />

      <Textarea
        label="Note"
        value={form.note}
        onChange={onChange("note")}
        inputClassName="min-h-[120px]"
        placeholder="Details eventuels..."
        disabled={disabled}
      />

      <Button
        className="bg-nodea-sage-dark hover:bg-nodea-sage-darker"
        type="submit"
        disabled={disabled}
      >
        {isEdit ? (loading ? "Chargement..." : "Mettre a jour") : "Enregistrer"}
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
