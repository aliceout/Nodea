import Select from "@/ui/atoms/form/Select";

export default function HistoFilters({
  threadFilter,
  setThreadFilter,
  yearFilter,
  setYearFilter,
  allThreads,
  years,
  groupBy,
  setGroupBy,
}) {
  return (
    <div className="mb-4 flex flex-wrap justify-between gap-2">
      <div className="flex flex-row gap-3">
        <Select
          value={threadFilter}
          onChange={(e) => setThreadFilter(e.target.value)}
        >
          <option value="">Tous les threads</option>
          {allThreads.map((thr) => (
            <option key={thr} value={thr}>
              {thr}
            </option>
          ))}
        </Select>
        <Select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="">Toutes les années</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <span className="text-sm">Regrouper par :</span>
        <span className="text-sm">Thread</span>
        <button
          type="button"
          role="switch"
          aria-checked={groupBy === "year"}
          onClick={() => setGroupBy(groupBy === "year" ? "thread" : "year")}
          className={`${
            groupBy === "year"
              ? "bg-nodea-sage-dark"
              : "bg-nodea-slate-light dark:bg-slate-700"
          } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nodea-sage-dark`}
        >
          <span
            className={`${
              groupBy === "year" ? "translate-x-5" : "translate-x-1"
            } inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform dark:bg-slate-200`}
          />
        </button>
        <span className="text-sm">Année</span>
      </div>
    </div>
  );
}
