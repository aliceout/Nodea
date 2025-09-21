import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMainKey } from "@/hooks/useMainKey";
import Button from "@/components/common/Button";
import {
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from "@/services/dataModules/Goals";

/**
 * Formulaire Goals
 * - Crée ou édite une entrée (une entrée = un objectif)
 * - Champs payload (clair, chiffré ensuite côté service) :
 *   { date, title, note?, status, categories[] }
 * - Statuts : open | wip | done
 *
 * Dépendances côté services :
 *   - getGoalById(mainKey, id)
 *   - createGoal(mainKey, payload)
 *   - updateGoal(mainKey, id, prevEntry, payload)
 *   - deleteGoal(mainKey, id, prevEntry)
 *
 * Style conservé.
 */
export default function GoalsForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mainKey } = useMainKey();

  const isEdit = useMemo(() => Boolean(id), [id]);

  // 👉 Fix: si création (pas d'id), on ne bloque pas l'affichage
  const [loading, setLoading] = useState(isEdit);
  const [initialEntry, setInitialEntry] = useState(null);
  const [form, setForm] = useState({
    date: "",
    title: "",
    note: "",
    status: "open",
    categoriesText: "", // Edition sous forme "tag1, tag2"
  });
  const [error, setError] = useState("");

  // Charger l'entrée si édition
  useEffect(() => {
    let mounted = true;
    async function load() {
      // En édition, on attend mainKey ; en création on ne charge rien
      if (!isEdit) {
        if (mounted) setLoading(false);
        return;
      }
      if (!mainKey) return; // on attend la clé, mais on ne rend pas null pour autant

      try {
        const entry = await getGoalById(mainKey, id);
        if (!mounted) return;
        setInitialEntry(entry);
        setForm({
          date: entry.date || "",
          title: entry.title || "",
          note: entry.note || "",
          status: entry.status || "open",
          categoriesText: (entry.categories || []).join(", "),
        });
      } catch (e) {
        console.error(e);
        setError("Impossible de charger l'objectif.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [mainKey, id, isEdit]);

  const onChange = (key) => (e) => {
    setForm((s) => ({ ...s, [key]: e.target.value }));
  };

  const parseCategories = () =>
    form.categoriesText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

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

    const payload = {
      date: form.date || "",
      title: form.title.trim(),
      note: form.note || "",
      status: form.status,
      categories: parseCategories(),
    };

    try {
      if (isEdit) {
        await updateGoal(mainKey, id, initialEntry, payload);
      } else {
        await createGoal(mainKey, payload);
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
    try {
      await deleteGoal(mainKey, id, initialEntry);
      navigate("..");
    } catch (e) {
      console.error(e);
      setError("Échec de la suppression.");
    }
  };

  // 👉 On n'occulte plus le rendu quand ça charge : on affiche le form,
  // et on désactive les actions si besoin.
  const disabled = isEdit && loading;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Titre</label>
          <input
            type="text"
            value={form.title}
            onChange={onChange("title")}
            className="border rounded px-3 py-2"
            placeholder="Ex. Lancer un blog"
            required
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={onChange("date")}
            className="border rounded px-3 py-2"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Statut</label>
          <select
            value={form.status}
            onChange={onChange("status")}
            className="border rounded px-3 py-2"
            disabled={disabled}
          >
            <option value="open">Ouvert</option>
            <option value="wip">En cours</option>
            <option value="done">Terminé</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Catégories</label>
          <input
            type="text"
            value={form.categoriesText}
            onChange={onChange("categoriesText")}
            className="border rounded px-3 py-2"
            placeholder="Ex. travail, santé, perso"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500">
            Sépare par des virgules (ex. <i>travail, santé</i>).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-600">Note</label>
        <textarea
          value={form.note}
          onChange={onChange("note")}
          className="border rounded px-3 py-2 min-h-[120px]"
          placeholder="Détails éventuels…"
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button className=" bg-nodea-sage-dark hover:bg-nodea-sage-darker" type="submit" disabled={disabled}>
          {isEdit ? (loading ? "Chargement…" : "Mettre à jour") : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate("..")}
        >
          Annuler
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
      </div>
    </form>
  );
}
