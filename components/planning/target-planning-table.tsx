"use client";

import { useMemo } from "react";
import { PLANNING_TARGET_ROWS, computeTargetFullYear } from "@/lib/planning-target-calc";
import type { PlanningYearData, MonthlyValues } from "@/types/api";
import { EditableCell } from "./editable-cell";
import { CalculatedCell } from "./calculated-cell";

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const QUARTERS = [
  { label: "Q1", cols: 3 },
  { label: "Q2", cols: 3 },
  { label: "Q3", cols: 3 },
  { label: "Q4", cols: 3 },
];

function formatDisplay(
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

interface TargetPlanningTableProps {
  year: number;
  data: PlanningYearData;
  onCellChange: (month: number, metric: string, value: number | undefined) => void;
}

export function TargetPlanningTable({ year, data, onCellChange }: TargetPlanningTableProps) {
  const { months, totals, average } = useMemo(() => computeTargetFullYear(data), [data]);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        {/* Title row */}
        <thead>
          <tr className="bg-blue-800 text-white">
            <th
              colSpan={15}
              className="px-3 py-2 text-center text-sm font-bold tracking-wide"
            >
              PLANEJAMENTO {year}
            </th>
          </tr>

          {/* Quarter headers */}
          <tr className="bg-blue-700 text-white">
            <th className="sticky left-0 z-20 bg-blue-700 px-3 py-1" />
            {QUARTERS.map((q) => (
              <th
                key={q.label}
                colSpan={q.cols}
                className="px-2 py-1 text-center text-xs font-bold border-l border-blue-600"
              >
                {q.label}
              </th>
            ))}
            <th className="px-2 py-1 text-center text-xs font-bold border-l border-blue-600" />
            <th className="px-2 py-1 text-center text-xs font-bold border-l border-blue-600" />
          </tr>

          {/* Month headers */}
          <tr className="bg-blue-600 text-white">
            <th className="sticky left-0 z-20 bg-blue-600 px-3 py-2 text-left text-xs font-semibold min-w-[260px]">
              Mês
            </th>
            {MONTHS.map((m) => (
              <th key={m} className="px-2 py-2 text-center text-xs font-semibold min-w-[110px]">
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-xs font-bold min-w-[120px] bg-blue-700">
              TOTAL
            </th>
            <th className="px-2 py-2 text-center text-xs font-bold min-w-[110px] bg-blue-700">
              Média
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {PLANNING_TARGET_ROWS.map((row) => {
            const isCalc = row.type === "calc";
            const isInput = row.type === "input";
            return (
              <tr
                key={row.key}
                className={`${
                  isInput ? "bg-orange-50" : "bg-white"
                } border-b border-zinc-100`}
              >
                {/* Metric label — sticky left */}
                <td
                  className={`sticky left-0 z-10 border-r border-zinc-200 px-3 py-1 text-xs font-medium whitespace-nowrap ${
                    isInput ? "bg-orange-50 text-orange-900 font-semibold" : "bg-white text-zinc-800"
                  }`}
                  title={row.formula ?? undefined}
                >
                  <span className={row.formula ? "cursor-help border-b border-dashed border-zinc-400" : ""}>
                    {row.label}
                  </span>
                </td>

                {/* 12 month cells */}
                {MONTHS.map((_, i) => {
                  const month = i + 1;
                  const monthData: MonthlyValues = months[month] ?? {};

                  if (isCalc) {
                    return (
                      <td
                        key={month}
                        className="border border-zinc-200 px-1.5 py-0.5 text-right text-xs font-medium text-zinc-700"
                        title={monthData[row.key] == null ? "Sem dados suficientes para cálculo" : undefined}
                      >
                        <span className={monthData[row.key] == null ? "text-zinc-400" : ""}>
                          {formatDisplay(monthData[row.key], row.format)}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <EditableCell
                      key={month}
                      value={data[month]?.[row.key]}
                      format={row.format}
                      synced={false}
                      onChange={(val) => onCellChange(month, row.key, val)}
                    />
                  );
                })}

                {/* TOTAL column */}
                <td
                  className={`border border-zinc-300 px-1.5 py-0.5 text-right text-xs font-bold ${
                    isInput ? "bg-orange-100 text-zinc-900" : "bg-blue-50 text-zinc-900"
                  }`}
                >
                  {formatDisplay(totals[row.key], row.format)}
                </td>

                {/* Média column */}
                <td
                  className="border border-zinc-300 px-1.5 py-0.5 text-right text-xs font-medium bg-zinc-50 text-zinc-700"
                >
                  {formatDisplay(average[row.key], row.format)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
