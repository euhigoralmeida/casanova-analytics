"use client";

import type { CohortRow } from "@/lib/crm-engine";

function cellColor(pct: number): string {
  if (pct === 0) return "bg-zinc-100 text-zinc-400";
  if (pct >= 100) return "bg-emerald-600 text-white";
  if (pct >= 40) return "bg-emerald-500 text-white";
  if (pct >= 25) return "bg-emerald-400 text-white";
  if (pct >= 15) return "bg-emerald-300 text-emerald-900";
  if (pct >= 8) return "bg-amber-200 text-amber-900";
  if (pct >= 3) return "bg-orange-200 text-orange-900";
  return "bg-red-200 text-red-800";
}

export function CohortHeatmap({ data }: { data: CohortRow[] }) {
  const maxMonths = Math.max(...data.map((c) => c.months.length));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 font-medium text-zinc-500">Cohort</th>
            <th className="text-right px-2 py-2 font-medium text-zinc-500">Clientes</th>
            {Array.from({ length: maxMonths }, (_, i) => (
              <th key={i} className="text-center px-1 py-2 font-medium text-zinc-500 min-w-[52px]">
                {i === 0 ? "Mes 0" : `Mes ${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.cohortMonth} className="border-t border-zinc-100">
              <td className="px-3 py-1.5 font-medium text-zinc-700 whitespace-nowrap">{row.cohortMonth}</td>
              <td className="px-2 py-1.5 text-right text-zinc-600">{row.totalCustomers.toLocaleString("pt-BR")}</td>
              {Array.from({ length: maxMonths }, (_, i) => {
                const pct = row.months[i];
                const hasData = pct !== undefined && pct > 0;
                return (
                  <td key={i} className="px-0.5 py-1">
                    <div className={`rounded px-1.5 py-1 text-center font-semibold ${hasData ? cellColor(pct) : "bg-zinc-50 text-zinc-300"}`}>
                      {hasData ? `${pct.toFixed(1).replace(".", ",")}%` : "\u2014"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
