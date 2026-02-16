"use client";

import { ChevronDown } from "lucide-react";

interface YearSelectorProps {
  year: number;
  onChange: (year: number) => void;
}

const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i);

export function YearSelector({ year, onChange }: YearSelectorProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none rounded-lg border border-zinc-300 bg-white px-4 py-2 pr-9 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500" />
    </div>
  );
}
