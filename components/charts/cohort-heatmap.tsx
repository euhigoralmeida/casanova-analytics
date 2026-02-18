"use client";

import React from "react";
import type { CohortRetentionData } from "@/lib/ga4-queries";

function retentionColor(pct: number): string {
  if (pct === 0) return "bg-zinc-100 text-zinc-400";
  if (pct >= 80) return "bg-emerald-600 text-white";
  if (pct >= 60) return "bg-emerald-500 text-white";
  if (pct >= 40) return "bg-emerald-400 text-white";
  if (pct >= 25) return "bg-emerald-300 text-emerald-900";
  if (pct >= 15) return "bg-amber-200 text-amber-900";
  if (pct >= 8) return "bg-orange-200 text-orange-900";
  if (pct >= 3) return "bg-red-200 text-red-800";
  return "bg-red-300 text-red-900";
}

const CohortHeatmap = React.memo(function CohortHeatmap({
  data,
}: {
  data: CohortRetentionData[];
}) {
  if (!data.length) {
    return (
      <div className="text-center py-8 text-sm text-zinc-400">
        Dados insuficientes para gerar heatmap de cohort.
      </div>
    );
  }

  const maxWeeks = Math.max(...data.map((c) => c.retention.length));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Cohort</th>
            <th className="text-right px-2 py-2 font-medium text-zinc-500 whitespace-nowrap">Usuários</th>
            {Array.from({ length: maxWeeks }, (_, i) => (
              <th key={i} className="text-center px-1 py-2 font-medium text-zinc-500 whitespace-nowrap min-w-[52px]">
                {i === 0 ? "Sem 0" : `Sem ${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((cohort) => (
            <tr key={cohort.cohortWeek} className="border-t border-zinc-100">
              <td className="px-3 py-1.5 font-medium text-zinc-700 whitespace-nowrap">
                {cohort.cohortWeek}
              </td>
              <td className="px-2 py-1.5 text-right text-zinc-600 whitespace-nowrap">
                {cohort.usersStart.toLocaleString("pt-BR")}
              </td>
              {Array.from({ length: maxWeeks }, (_, i) => {
                const pct = cohort.retention[i];
                const hasData = pct !== undefined && pct > 0;
                const absoluteUsers = hasData ? Math.round((cohort.usersStart * pct) / 100) : 0;
                return (
                  <td key={i} className="px-0.5 py-1">
                    <div
                      className={`rounded px-1.5 py-1 text-center font-semibold ${
                        hasData ? retentionColor(pct) : "bg-zinc-50 text-zinc-300"
                      }`}
                      title={hasData ? `${absoluteUsers.toLocaleString("pt-BR")} usuários (${pct.toFixed(1)}%)` : "—"}
                    >
                      {hasData ? `${pct.toFixed(1).replace(".", ",")}%` : "—"}
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
});

export default CohortHeatmap;
