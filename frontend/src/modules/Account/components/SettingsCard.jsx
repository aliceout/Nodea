export default function SettingsCard({ title, children, className = "" }) {
  return (
    <section
      className={`transition-colors border-b rounded-lg border p-6 mb-6 flex flex-col items-stretch ${className}`}
    >
      {title ? (
        <label className="text-sm font-semibold text-slate-900">{title}</label>
      ) : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}
