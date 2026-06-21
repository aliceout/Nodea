import { useNodeaStore, type ModuleId } from '@/core/store/nodea-store';

/**
 * « tout voir → » CTA shared by the Homepage cards — navigates to a flow
 * module via the store's `setModule`. Extracted from MoodBlock /
 * GoalsCard / HeroEntry / JournalHeatmap (REFACTO-08), which each
 * inlined the same button. `label` is passed already-translated since
 * the cards use different keys (home.viewAll vs home.hero.cta).
 */
interface HomeModuleLinkProps {
  module: ModuleId;
  label: string;
}

export default function HomeModuleLink({ module, label }: HomeModuleLinkProps) {
  const setModule = useNodeaStore((s) => s.setModule);
  return (
    <button
      type="button"
      onClick={() => setModule(module)}
      className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
    >
      {label} →
    </button>
  );
}
