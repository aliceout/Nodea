import { useCallback, useMemo } from "react";
import { ArrowRightIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { ResponsiveContainer } from "recharts";

import Subheader from "@/ui/layout/headers/Subheader";
import { MODULES } from "@/app/config/modules_list";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import useAuth from "@/core/auth/useAuth";
import {
  isModuleEnabled,
  useModulesRuntime,
} from "@/core/store/modulesRuntime";
import useMoodTrend from "@/app/flow/Mood/hooks/useMoodTrend";
import MoodChartBody from "@/app/flow/Mood/components/ChartBody";
import useLatestAnnouncement from "@/core/hooks/useLatestAnnouncement";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Badge from "@/ui/atoms/feedback/Badge.jsx";
import SectionHeader from "@/ui/atoms/typography/SectionHeader.jsx";
import Surface from "@/ui/atoms/layout/Surface.jsx";
import Button from "@/ui/atoms/base/Button.jsx";

function getPreferredName(user) {
  if (!user) return "";
  if (user.firstname && user.lastname) {
    return `${user.firstname} ${user.lastname}`.trim();
  }
  if (user.firstname) return user.firstname;
  if (user.name) return user.name;
  if (user.username) return user.username;
  if (user.email) {
    const [localPart] = user.email.split("@");
    return localPart || "";
  }
  return "";
}

function ModuleCard({ module, onNavigate }) {
  const Icon = module.icon;
  const { t } = useI18n();
  const label = t(module.label, { defaultValue: module.label });
  const description = module.description
    ? t(module.description, { defaultValue: module.description })
    : "";

  return (
    <SurfaceCard
      as="button"
      type="button"
      onClick={() => onNavigate(module.id)}
      tone="base"
      border="default"
      padding="md"
      interactive
      className="h-full w-full text-left"
      bodyClassName="flex items-start gap-3"
    >
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)] sm:inline-flex">
        {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)] sm:hidden">
              {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
            </span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {label}
            </p>
          </div>
          <Badge tone="success">{t("settings.modules.badges.active")}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      </div>
      <ArrowRightIcon
        className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]"
        aria-hidden="true"
      />
    </SurfaceCard>
  );
}

function AnnouncementSpotlight() {
  const { status, announcement } = useLatestAnnouncement();
  const { t } = useI18n();

  if (status === "ready" && announcement) {
    const title = announcement.title || "Actualite Nodea";
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
        <h3 className="text-lg font-semibold text-[var(--text-inverse)]">
          {title}
        </h3>
        {formattedDate ? (
          <p className="text-xs text-[var(--text-inverse)]/70">
            {t("home.announcement.publishedOn", {
              defaultValue: "Publié le {date}",
              values: { date: formattedDate },
            })}
          </p>
        ) : null}
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

function MiniMoodChartCard({ module }) {
  const Icon = module?.icon;
  const { status, data, error } = useMoodTrend({ months: 1 });
  const { t } = useI18n();
  const moduleLabel = module
    ? t(module.label, { defaultValue: module.label })
    : t("modules.mood.label", { defaultValue: "Mood" });

  const average = useMemo(() => {
    if (!data.length) return null;
    const total = data.reduce((sum, item) => sum + Number(item.mood || 0), 0);
    return Number.isFinite(total) ? total / data.length : null;
  }, [data]);
  const averageLabel =
    average !== null ? average.toFixed(1).replace(/\.0$/, "") : "--";

  let message = "";
  if (status === "loading") message = "Chargement...";
  else if (status === "missing-key")
    message = "Reconnexion requise pour afficher le graphique.";
  else if (status === "missing-module")
    message = "Active le module Mood pour afficher le graphique.";
  else if (status === "error") message = error;
  else if (!data.length) message = "Aucune donnee pour le moment.";

  const showChart = status === "ready" && data.length > 0;

  return (
    <SurfaceCard tone="base" border="default" padding="lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t("home.mood.quickView", { defaultValue: "Aperçu rapide" })}
            </p>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {moduleLabel}
            </h3>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {t("home.mood.monthAverage", {
              defaultValue: "Moyenne mois en cours",
            })}
          </p>
          <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {averageLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 h-40">
        {showChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <MoodChartBody data={data} />
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 text-center text-sm text-[var(--text-muted)]">
            {message}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { dispatch } = useStore();
  const { user } = useAuth();
  const modulesRuntime = useModulesRuntime();

  const name = useMemo(() => getPreferredName(user), [user]);

  const { greeting, formattedDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let currentGreeting = "Bonjour";
    if (hour >= 18) currentGreeting = "Bonsoir";
    else if (hour >= 12) currentGreeting = "Bon apres-midi";

    const formatter = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const label = formatter.format(now);
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);

    return { greeting: currentGreeting, formattedDate: capitalized };
  }, []);

  const modules = useMemo(() => {
    return MODULES.filter(
      (module) => module.id !== "home" && module.display !== false
    ).map((module) => ({
      ...module,
      enabled: !module.to_toggle || isModuleEnabled(modulesRuntime, module.id),
    }));
  }, [modulesRuntime]);

  const enabledModules = useMemo(
    () => modules.filter((module) => module.enabled),
    [modules]
  );
  const disabledModules = useMemo(
    () => modules.filter((module) => !module.enabled),
    [modules]
  );

  const moodModule = useMemo(
    () => enabledModules.find((module) => module.id === "mood") || null,
    [enabledModules]
  );

  const handleNavigate = useCallback(
    (moduleId) => {
      dispatch(setTab(moduleId));
    },
    [dispatch]
  );

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader />

      <div className="flex-1 pt-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-2xl border border-slate-900/10 bg-slate-900 text-white">
            <div className="absolute -right-16 top-1/2 hidden h-48 w-48 -translate-y-1/2 rounded-full bg-slate-700/40 blur-3xl md:block" />
            <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
                  {formattedDate}
                </p>
                <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                  {name ? `${greeting}, ${name}` : `${greeting} !`}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">
                  Retrouvez vos espaces Nodea en un clin d&apos;oeil. Choisissez
                  un module pour poursuivre votre routine ou decouvrir de
                  nouvelles pistes.
                </p>
              </div>

              <AnnouncementSpotlight />
            </div>
          </section>

          {moodModule ? <MiniMoodChartCard module={moodModule} /> : null}

          {enabledModules.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader
                title={t("home.sections.actions.title", {
                  defaultValue: "Actions rapides",
                })}
                description={t("home.sections.actions.description", {
                  defaultValue:
                    "Accède directement aux modules que tu utilises le plus souvent.",
                })}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {enabledModules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {disabledModules.length > 0 ? (
            <Surface tone="muted" border="default" padding="lg" className="space-y-4">
              <SectionHeader
                title={t("home.sections.available.title", {
                  defaultValue: "Modules disponibles",
                })}
                description={t("home.sections.available.description", {
                  defaultValue:
                    "Active de nouveaux espaces pour enrichir ton accompagnement.",
                })}
              />

              <div className="flex flex-wrap gap-2">
                {disabledModules.map((module) => {
                  const Icon = module.icon;
                  const label = t(module.label, { defaultValue: module.label });
                  return (
                    <span
                      key={module.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1 text-sm text-[var(--text-secondary)]"
                    >
                      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                      {label}
                    </span>
                  );
                })}
              </div>

              <Button
                type="button"
                onClick={() => handleNavigate("settings")}
                className="inline-flex items-center gap-2 self-start"
              >
                {t("home.sections.available.cta", {
                  defaultValue: "Ouvrir les paramètres",
                })}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Surface>
          ) : null}
        </div>
      </div>
    </div>
  );
}
