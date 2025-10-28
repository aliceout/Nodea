import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import ThemeSelector from "@/ui/atoms/specifics/ThemeSelector.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function ThemePreferences() {
  const { t } = useI18n();

  return (
    <SurfaceCard>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t("settings.theme.description")}
      </p>
      <div className="mt-4">
        <ThemeSelector variant="card" className="w-full sm:w-auto" />
      </div>
    </SurfaceCard>
  );
}
