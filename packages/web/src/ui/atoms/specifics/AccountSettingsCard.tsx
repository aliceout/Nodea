import type { ReactNode } from 'react';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard.jsx';

export interface AccountSettingsCardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Card shell used in the Account page for each settings section
 * (change email, reset password). Thin wrapper over `SurfaceCard`;
 * kept separate to allow future tweaks to the shared Account visual
 * rhythm without touching the generic Surface primitives.
 */
export default function AccountSettingsCard({
  title,
  description,
  children,
  className,
}: AccountSettingsCardProps) {
  return (
    <SurfaceCard tone="base" border="default" padding="md" className={className}>
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs opacity-70">{description}</p> : null}
      </div>
      {children}
    </SurfaceCard>
  );
}
