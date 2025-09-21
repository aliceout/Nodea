import React from "react";
import Select from "@/components/common/Select";

export default function GoalsFilters({
  categoryFilter,
  setCategoryFilter,
  yearFilter,
  setYearFilter,
  allCategories,
  years,
}) {
  return (
    <div className="flex gap-2 justify-center mb-4">
      <Select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
      >
        <option value="">Toutes les catégories</option>
        {allCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
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
