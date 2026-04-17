import Surface from "@/ui/atoms/layout/Surface.jsx";
import useLatestAnnouncement from "@/core/hooks/useLatestAnnouncement";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function AnnouncementSpotlight() {
  const { status, announcement } = useLatestAnnouncement();
  const { t } = useI18n();

  if (status === "ready" && announcement) {
    const title = announcement.title || t("home.announcement.label", { defaultValue: "Nouvelle" });
    const message = announcement.message || "";
    const date = announcement.published_at || announcement.created;
    const formattedDate = date
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
        }).format(new Date(date))
      : null;

    return (
      <Surface
        as="aside"
        tone="inverse"
        border="minimal"
        padding="md"
        radius="lg"
        shadow="sm"
        className="w-full max-w-sm gap-3"
      >
        <p className="text-xs uppercase tracking-wide text-[var(--text-inverse)]/70">
          {t("home.announcement.label", { defaultValue: "Nouvelle" })}
        </p>
        {formattedDate ? (
          <p className="text-xs text-[var(--text-inverse)]/70">
            {t("home.announcement.publishedOn", {
              defaultValue: "Publié le {date}",
              values: { date: formattedDate },
            })}
          </p>
        ) : null}
            <h3 className="text-lg font-semibold text-[var(--text-inverse)]">
              {title}
            </h3>
        {message ? (
          <p className="text-sm leading-relaxed text-[var(--text-inverse)]/90">
            {message}
          </p>
        ) : null}
      </Surface>
    );
  }

  if (status === "loading") {
    return (
      <Surface
        as="aside"
        tone="inverse"
        border="minimal"
        padding="md"
        radius="lg"
        shadow="sm"
        className="w-full max-w-sm gap-2 opacity-80"
      >
        <p className="text-sm text-[var(--text-inverse)]/80">
          {t("home.announcement.loading", {
            defaultValue: "Chargement des nouveautés…",
          })}
        </p>
      </Surface>
    );
  }

  return null;
}

