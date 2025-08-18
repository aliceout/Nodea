export default function SettingsCard({ title, children }) {
  return (
    <section className=" bg-white p-4 sm:p-5 border-b border-gray-300 px-4 sm:px-6 lg:px-8">
      {title ? (
        <label className="text-sm font-semibold text-slate-900">{title}</label>
      ) : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}
