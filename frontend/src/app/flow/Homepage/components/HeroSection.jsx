import clsx from "clsx";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export default function HeroSection({
  greeting,
  name,
  formattedDate,
  className = "",
}) {
  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-slate-900/10 bg-slate-900 text-white",
        className
      )}
    >
      <div className="absolute -right-16 top-1/2 hidden h-48 w-48 -translate-y-1/2 rounded-full bg-slate-700/40 blur-3xl md:block" />
      <div className="relative flex flex-col gap-6 p-6 md:p-8">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
          {formattedDate}
        </p>
        <h2 className="text-2xl font-semibold sm:text-3xl">
          {name ? `${greeting}, ${name}` : `${greeting} !`}
        </h2>
        <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
          Retrouvez vos espaces Nodea en un clin d’œil. Choisissez un module pour
          poursuivre votre routine ou découvrir de nouvelles pistes.
        </p>
      </div>
    </section>
  );
}
