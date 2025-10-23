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
import MoodChartBody, {
  formatDDMM,
} from "@/app/flow/Mood/components/ChartBody";
import useLatestAnnouncement from "@/core/hooks/useLatestAnnouncement";

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

  return (
    <button
      type="button"
      onClick={() => onNavigate(module.id)}
      className="group h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Module actif
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        {module.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {module.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 transition group-hover:gap-1.5">
        Ouvrir le module
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  );
}

function AnnouncementSpotlight() {
  const { status, announcement } = useLatestAnnouncement();

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
      <aside className="w-full max-w-sm rounded-2xl border border-slate-700/40 bg-slate-800/40 p-5 text-white shadow-inner backdrop-blur">
        <p className="text-xs uppercase tracking-wide text-slate-300">
          Nouveaute
        </p>
        <h3 className="mt-2 text-lg font-semibold">{title}</h3>
        {formattedDate ? (
          <p className="mt-1 text-xs text-slate-200/80">
            Publie le {formattedDate}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-100/90">
            {message}
          </p>
        ) : null}
      </aside>
    );
  }

  if (status === "loading") {
    return (
      <aside className="w-full max-w-sm rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 text-white shadow-inner backdrop-blur">
        <p className="text-sm text-slate-200">Chargement des nouveautes...</p>
      </aside>
    );
  }

  return null;
}

function MiniMoodChartCard({ module, onNavigate }) {
  const Icon = module?.icon;
  const { status, data, error } = useMoodTrend({ months: 1 });

  const latest = useMemo(
    () => (data.length ? data[data.length - 1] : null),
    [data]
  );
  const average = useMemo(() => {
    if (!data.length) return null;
    const total = data.reduce((sum, item) => sum + Number(item.mood || 0), 0);
    return Number.isFinite(total) ? total / data.length : null;
  }, [data]);

  const lastLabel = latest ? formatDDMM(latest.date) : "";
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mood rapide
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {module?.label || "Mood"}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("mood")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Ouvrir
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Dernier releve
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900">
              {latest ? latest.mood : "--"}
            </span>
            {latest?.emoji ? (
              <span className="text-2xl" aria-hidden="true">
                {latest.emoji}
              </span>
            ) : null}
          </div>
          {lastLabel ? (
            <p className="mt-1 text-xs text-slate-500">Releve du {lastLabel}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Moyenne mois en cours
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {averageLabel}
          </p>
        </div>
      </div>

      <div className="mt-6 h-40">
        {showChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <MoodChartBody data={data} />
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
            {message}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
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
    <div className="flex flex-col min-h-full bg-slate-50">
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

          {moodModule ? (
            <MiniMoodChartCard
              module={moodModule}
              onNavigate={handleNavigate}
            />
          ) : null}

          {enabledModules.length > 0 ? (
            <section className="space-y-3">
              <header>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Actions rapides
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Accedez directement aux modules actifs que vous utilisez le
                  plus souvent.
                </p>
              </header>

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
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Modules disponibles
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Activez de nouveaux espaces pour enrichir votre accompagnement.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {disabledModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <span
                      key={module.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600"
                    >
                      {Icon ? (
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                      {module.label}
                    </span>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleNavigate("settings")}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ouvrir les parametres
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
