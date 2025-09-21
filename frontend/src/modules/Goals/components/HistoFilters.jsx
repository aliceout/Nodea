import React from "react";
import Select from "@/components/common/Select";

export default function HistoFilters({
  threadFilter,
  setThreadFilter,
  yearFilter,
  setYearFilter,
  allThreads,
  years,
}) {
  return (
    <div className="flex gap-2 justify-center mb-4">
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
  );
}
