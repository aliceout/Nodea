import { useEffect, useMemo, useState } from "react";

import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from "@/core/api/announcements";
import Input from "@/ui/atoms/form/Input";
import Textarea from "@/ui/atoms/form/Textarea";
import Button from "@/ui/atoms/base/Button";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Surface from "@/ui/atoms/layout/Surface.jsx";

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
      <Surface
        tone="muted"
        border="strong"
        padding="md"
        className="text-sm text-[var(--text-secondary)]"
      >
        <p className="font-semibold">Collection manquante</p>
        <p className="text-sm text-[var(--text-muted)]">
          Crée une collection <code>announcements</code> dans PocketBase avec
          les champs suivants&#8239;: <code>title</code> (text),{" "}
          <code>message</code> (text), <code>published</code> (bool) et{" "}
          <code>published_at</code> (date).
        </p>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard tone="base" border="default" padding="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="Nous avons ajouté…"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {error ? (
              <p className="text-sm text-[var(--accent-danger)]">{error}</p>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">
                Publie directement l’annonce sur la page d’accueil.
              </span>
            )}
            <Button
              type="submit"
              disabled={!canSubmit}
              unstyled
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent-primary-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary)] disabled:cursor-not-allowed disabled:bg-[var(--accent-primary)]/60"
            >
              {saving ? "Publication..." : "Publier"}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Dernières annonces
        </h3>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">
            Chargement...
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Aucune annonce publiée.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <SurfaceCard
                as="li"
                key={item.id}
                tone="base"
                border="default"
                padding="md"
                className="transition-colors"
                bodyClassName="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1 space-y-2">
                  <h4 className="text-base font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </h4>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {item.message}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    {new Date(item.published_at || item.created).toLocaleDateString(
                      "fr-FR"
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  unstyled
                  className="text-xs font-semibold text-[var(--accent-danger)] transition hover:text-[var(--accent-danger)]/80"
                >
                  Supprimer
                </Button>
              </SurfaceCard>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
