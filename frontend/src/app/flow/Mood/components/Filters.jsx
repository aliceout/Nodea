export default function HistoryFilters({
  month,
  setMonth,
  year,
  setYear,
  years,
}) {
  const handleMonthChange = (value) => {
    if (!value) {
      setMonth(null);
      return;
    }
    setMonth(Number(value));
  };

  return (
    <div className="flex justify-center gap-4 mb-6">
      <select
        value={month === null ? "" : String(month)}
        onChange={(e) => handleMonthChange(e.target.value)}
        className="border border-nodea-slate-light text-nodea-slate rounded p-1"
      >
        <option value="">6 derniers mois</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(0, i).toLocaleString("fr-FR", { month: "long" })}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="border rounded border-nodea-slate-light text-nodea-slate  p-1"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
