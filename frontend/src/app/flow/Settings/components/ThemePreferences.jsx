import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import ThemeSelector from "@/ui/atoms/specifics/ThemeSelector.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function ThemePreferences() {
  const { t } = useI18n();

  return (
    <SurfaceCard tone="base" border="default" padding="md">
      <ThemeSelector variant="card" className="w-full sm:w-auto" />
    </SurfaceCard>
  );
}
