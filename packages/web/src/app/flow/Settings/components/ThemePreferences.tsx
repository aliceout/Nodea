import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard.jsx';
import ThemeSelector from '@/ui/atoms/specifics/ThemeSelector.jsx';

/**
 * Thin wrapper around the legacy `ThemeSelector` primitive. All the
 * theme state (light / dark / system) is handled inside the selector
 * itself — this component just provides the surface.
 */
export default function ThemePreferences() {
  return (
    <SurfaceCard tone="base" border="default" padding="md">
      <ThemeSelector variant="card" className="w-full sm:w-auto" />
    </SurfaceCard>
  );
}
