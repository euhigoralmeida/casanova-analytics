"use client";

import { useMemo } from "react";
import { PLANNING_ROWS, computeFullYear } from "@/lib/planning-calc";
import type { PlanningYearData, MonthlyValues } from "@/types/api";
import { EditableCell } from "./editable-cell";
import { CalculatedCell } from "./calculated-cell";

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Metrics that are auto-synced from Google Ads / GA4 */
const SYNCABLE_METRICS = new Set([
  "google_ads",
  "usuarios_visitantes",
  "sessoes_totais",
  "sessoes_midia",
  "sessoes_organicas",
  "sessoes_engajadas",
  "taxa_rejeicao",
]);

type SourcesMap = Record<number, Record<string, string>>;

interface AnnualPlanningTableProps {
  data: PlanningYearData;
  sources?: SourcesMap;
  onCellChange: (month: number, metric: string, value: number | undefined) => void;
}

function formatTotalDisplay(
  value: number | undefined | null,
  format: string
): string {
  if (value == null) return "\u2014";
  switch (format) {
    case "currency":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "percent":
      return (value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    case "number":
      return Math.round(value).toLocaleString("pt-BR");
    case "number2":
      return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return String(value);
  }
}

export function AnnualPlanningTable({ data, sources, onCellChange }: AnnualPlanningTableProps) {
  const { months, totals } = useMemo(() => computeFullYear(data), [data]);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="bg-zinc-800 text-white">
            <th className="sticky left-0 z-20 bg-zinc-800 px-3 py-2 text-left text-xs font-semibold min-w-[220px]">
              MÉTRICAS
            </th>
            {MONTHS.map((m) => (
              <th key={m} className="px-2 py-2 text-center text-xs font-semibold min-w-[110px]">
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-xs font-bold min-w-[120px] bg-zinc-900">
              TOTAL
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {PLANNING_ROWS.map((row) => {
            const isCalc = row.type === "calc";
            const isSyncable = !isCalc && SYNCABLE_METRICS.has(row.key);
            return (
              <tr
                key={row.key}
                className={`${
                  isCalc ? "bg-amber-50" : isSyncable ? "bg-zinc-100" : "bg-white hover:bg-zinc-50"
                } border-b border-zinc-100`}
              >
                {/* Metric label — sticky left */}
                <td
                  className={`sticky left-0 z-10 border-r border-zinc-200 px-3 py-1 text-xs font-medium whitespace-nowrap ${
                    isCalc ? "bg-amber-50 text-amber-900" : isSyncable ? "bg-zinc-100 text-zinc-700" : "bg-white text-zinc-800"
                  }`}
                  title={row.formula ?? undefined}
                >
                  <span className={row.formula ? "cursor-help border-b border-dashed border-amber-400" : ""}>
                    {row.label}
                  </span>
                </td>

                {/* 12 month cells */}
                {MONTHS.map((_, i) => {
                  const month = i + 1;
                  const monthData: MonthlyValues = months[month] ?? {};

                  if (isCalc) {
                    return (
                      <CalculatedCell
                        key={month}
                        value={monthData[row.key]}
                        format={row.format}
                      />
                    );
                  }

                  return (
                    <EditableCell
                      key={month}
                      value={data[month]?.[row.key]}
                      format={row.format}
                      synced={isSyncable}
                      onChange={(val) => onCellChange(month, row.key, val)}
                    />
                  );
                })}

                {/* TOTAL column */}
                <td
                  className={`border border-zinc-300 px-1.5 py-0.5 text-right text-xs font-bold ${
                    isCalc ? "bg-amber-100 text-zinc-900" : "bg-blue-50 text-zinc-900"
                  }`}
                  title={totals[row.key] == null ? "Sem dados suficientes" : undefined}
                >
                  {formatTotalDisplay(totals[row.key], row.format)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
