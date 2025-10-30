import clsx from "clsx";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import Surface from "@/ui/atoms/layout/Surface.jsx";

import "./HeroSection.css";

export default function HeroSection({
  greeting,
  name,
  formattedDate,
  className = "",
}) {
  return (
    <Surface
      as="section"
      padding="lg"
      shadow="md"
      border="strong"
      className={clsx("hero-section", className)}
    >
      <div className="hero-section__glow" aria-hidden="true" />
      <div className="hero-section__content">
        <p className="hero-section__meta">
          <CalendarDaysIcon className="hero-section__meta-icon" aria-hidden="true" />
          {formattedDate}
        </p>
        <h2 className="hero-section__title">
          {name ? `${greeting}, ${name}` : `${greeting} !`}
        </h2>
        <p className="hero-section__description">
          Retrouvez vos espaces Nodea en un clin d'œil. Choisissez un module pour
          poursuivre votre routine ou découvrir de nouvelles pistes.
        </p>
      </div>
    </Surface>
  );
}
