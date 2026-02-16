"use client";

import type { PlanningRowFormat } from "@/types/api";

interface CalculatedCellProps {
  value: number | undefined | null;
  format: PlanningRowFormat;
  isTotal?: boolean;
}

function formatCalc(value: number | undefined | null, format: PlanningRowFormat): string {
  if (value == null) return "\u2014"; // em dash
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

export function CalculatedCell({ value, format, isTotal }: CalculatedCellProps) {
  const isEmpty = value == null;
  return (
    <td
      className={`border border-zinc-200 px-1.5 py-0.5 text-right text-xs ${
        isTotal ? "bg-amber-100 font-bold text-zinc-900" : "bg-amber-50 font-medium text-zinc-700"
      }`}
      title={isEmpty ? "Sem dados suficientes para cálculo" : undefined}
    >
      <span className={isEmpty ? "text-zinc-400" : ""}>
        {formatCalc(value, format)}
      </span>
    </td>
  );
}
