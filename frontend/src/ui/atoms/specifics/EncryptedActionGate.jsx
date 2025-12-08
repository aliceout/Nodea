import clsx from "clsx";

/**
 * Carte d'information affichée lorsque la clé principale est absente.
 */
export default function EncryptedActionGate({
  title,
  description,
  hint,
  className = "",
}) {
  return (
    <div
      className={clsx(
        "mb-6 flex flex-col items-stretch rounded-lg border border-gray-200 bg-white p-6",
        className
      )}
    >
      <div className="mb-4 w-full">
        {title ? (
          <div className="mb-1 text-base font-semibold text-gray-900">
            {title}
          </div>
        ) : null}
        {description ? (
          <div className="text-sm text-gray-600">{description}</div>
        ) : null}
      </div>
      {hint ? (
        <div
          role="alert"
          aria-live="polite"
          className="w-full rounded-md border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700"
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
