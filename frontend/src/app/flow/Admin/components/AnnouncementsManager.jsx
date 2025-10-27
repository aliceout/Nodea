import { useEffect, useMemo, useState } from "react";

import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from "@/core/api/announcements";
import Input from "@/ui/atoms/form/Input";
import Textarea from "@/ui/atoms/form/Textarea";
import Button from "@/ui/atoms/base/Button";
import SettingsCard from "@/ui/atoms/specifics/SettingsCard";

const INITIAL_FORM = {
  title: "",
  message: "",
};

export default function AnnouncementsManager() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listAnnouncements({ limit: 10, throwOnError: true })
      .then((results) => {
        if (mounted) setItems(results);
      })
      .catch((err) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Impossible de charger.";
        setError(message);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const missingCollection = useMemo(
    () =>
      Boolean(error) &&
      /collection|announcements/i.test(error) &&
      items.length === 0,
    [error, items.length]
  );

  const canSubmit =
    form.title.trim().length > 0 && form.message.trim().length > 0 && !saving;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError("");

    try {
      const record = await createAnnouncement({
        title: form.title.trim(),
        message: form.message.trim(),
        published: true,
      });
      setItems((prev) => [record, ...prev]);
      setForm(INITIAL_FORM);
      setError("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible de publier.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette annonce ?")) return;
    try {
      await deleteAnnouncement(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setError("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Suppression impossible.";
      setError(message);
    }
  };

  if (missingCollection) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">Collection manquante</p>
        <p className="mt-1">
          Cree une collection <code>announcements</code> dans PocketBase avec
          les champs suivants : <code>title</code> (text),{" "}
          <code>message</code> (text), <code>published</code> (bool),
          <code>published_at</code> (date). Les annonces seront ensuite
          disponibles ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard className="border-gray-200 hover:border-gray-300 bg-white">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            name="title"
            label="Titre"
            value={form.title}
            onChange={handleChange}
            placeholder="Nouveau module disponible"
            maxLength={120}
          />

          <Textarea
            id="message"
            name="message"
            label="Message"
            rows={4}
            value={form.message}
            onChange={handleChange}
            placeholder="Nous avons ajoute ..."
          />

          <div className="flex items-center justify-between">
            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <span className="text-xs text-slate-500">
                Publie directement l&apos;annonce sur la page d&apos;accueil.
              </span>
            )}
            <Button
              type="submit"
              disabled={!canSubmit}
              unstyled
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Publication..." : "Publier"}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dernieres annonces
        </h3>

        {loading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune annonce publiee.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                      Publie le{" "}
                      {new Date(item.published_at || item.created).toLocaleDateString(
                        "fr-FR"
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
