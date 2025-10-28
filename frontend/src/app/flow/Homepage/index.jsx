import { useCallback, useMemo } from "react";

import Subheader from "@/ui/layout/headers/Subheader";
import SectionHeader from "@/ui/atoms/typography/SectionHeader.jsx";
import { MODULES } from "@/app/config/modules_list";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import useAuth from "@/core/auth/useAuth";
import {
  isModuleEnabled,
  useModulesRuntime,
} from "@/core/store/modulesRuntime";
import { useI18n } from "@/i18n/I18nProvider.jsx";

import HeroSection from "./components/HeroSection.jsx";
import AnnouncementSpotlight from "./components/AnnouncementSpotlight.jsx";
import MoodOverview from "./components/MoodOverview.jsx";
import ModuleCard from "./components/ModuleCard.jsx";
import AvailableModules from "./components/AvailableModules.jsx";

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

export default function HomePage() {
  const { dispatch } = useStore();
  const { user } = useAuth();
  const modulesRuntime = useModulesRuntime();
  const { t } = useI18n();

  const name = useMemo(() => getPreferredName(user), [user]);

  const { greeting, formattedDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let currentGreeting = "Bonjour";
    if (hour >= 18) currentGreeting = "Bonsoir";
    else if (hour >= 12) currentGreeting = "Bon après-midi";

    const formatter = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    return {
      greeting: currentGreeting,
      formattedDate: formatter.format(now),
    };
  }, []);

  const modules = useMemo(() => {
    return MODULES.filter((module) => module.id !== "home" && module.display !== false).map((module) => ({
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

  const quickActionsLabel = t("home.sections.actions.title", {
    defaultValue: "Actions rapides",
  });
  const activeBadgeLabel = t("settings.modules.badges.active", {
    defaultValue: "Module actif",
  });

  const renderQuickActions = enabledModules.length > 0;
  const renderMood = Boolean(moodModule);

  return (
    <div className="flex min-h-full flex-col">
      <Subheader />

      <div className="flex-1 pt-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <HeroSection
              greeting={greeting}
              name={name}
              formattedDate={formattedDate}
              className="lg:col-span-2"
            />
            <AnnouncementSpotlight />
          </div>

          {(renderQuickActions || renderMood) && (
            <div
              className={`grid gap-4 ${
                renderQuickActions && renderMood ? "lg:grid-cols-3" : ""
              }`}
            >
              {renderQuickActions && (
                <section className={`space-y-4 ${renderMood ? "lg:col-span-1" : "lg:col-span-3"}`}>
                  <SectionHeader title={quickActionsLabel} />
                  <div className="flex flex-col">
                    {enabledModules.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        onNavigate={handleNavigate}
                        badgeLabel={activeBadgeLabel}
                      />
                    ))}
                  </div>
                </section>
              )}

              {renderMood && (
                <div className={renderQuickActions ? "lg:col-span-2" : "lg:col-span-3"}>
                  <MoodOverview module={moodModule} />
                </div>
              )}
            </div>
          )}

          <AvailableModules modules={disabledModules} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  );
}
