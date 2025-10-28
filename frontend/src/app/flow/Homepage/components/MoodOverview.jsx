import { ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import useMoodTrend from "@/app/flow/Mood/hooks/useMoodTrend";
import MoodChartBody from "@/app/flow/Mood/components/ChartBody";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function MoodOverview({ module }) {
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
  if (status === "loading") message = t("home.mood.loading", { defaultValue: "Chargement..." });
  else if (status === "missing-key")
    message = t("home.mood.missingKey", {
      defaultValue: "Reconnexion requise pour afficher le graphique.",
    });
  else if (status === "missing-module")
    message = t("home.mood.missingModule", {
      defaultValue: "Active le module Mood pour afficher le graphique.",
    });
  else if (status === "error") message = error;
  else if (!data.length) message = t("home.mood.empty", { defaultValue: "Aucune donnée pour le moment." });

  const showChart = status === "ready" && data.length > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("home.mood.quickView", { defaultValue: "Aperçu rapide" })}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {moduleLabel}
            </h3>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t("home.mood.monthAverage", {
              defaultValue: "Moyenne mois en cours",
            })}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
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
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            {message}
          </div>
        )}
      </div>
    </section>
  );
}

