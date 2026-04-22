import clsx from "clsx";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";

/**
 * Wrapper pour les cartes de réglages du compte. Évite de répéter
 * l'en-tête (titre + description) et laisse le contrôle du contenu interne.
 */
export default function AccountSettingsCard({
  title,
  description,
  children,
  className = "",
  bodyClassName = "flex flex-col gap-6 items-stretch",
  ...props
}) {
  return (
    <SurfaceCard
      title={title}
      description={description}
      className={clsx("border-gray-200 hover:border-gray-300", className)}
      bodyClassName={bodyClassName}
      {...props}
    >
      {children}
    </SurfaceCard>
  );
}
