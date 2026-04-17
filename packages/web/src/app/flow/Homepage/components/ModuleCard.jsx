import { ArrowRightIcon } from "@heroicons/react/24/outline";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Badge from "@/ui/atoms/feedback/Badge.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function ModuleCard({ module, onNavigate, badgeLabel }) {
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
          {badgeLabel ? <Badge tone="success">{badgeLabel}</Badge> : null}
        </div>
        {description ? (
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <ArrowRightIcon
        className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]"
        aria-hidden="true"
      />
    </SurfaceCard>
  );
}

