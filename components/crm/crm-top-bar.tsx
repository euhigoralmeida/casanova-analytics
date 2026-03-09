"use client";

import { RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/ui/date-range-picker";
import { FilialMultiSelect } from "./filial-select";
import type { Filial } from "./crm-hooks";
import type { DateRange } from "@/types/api";

export function CRMTopBar({
  title,
  subtitle,
  source,
  loading,
  updatedLabel,
  dateRange,
  availableFiliais,
  selectedFiliais,
  onDateChange,
  onFiliaisChange,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  source?: "magazord" | "not_configured";
  loading: boolean;
  updatedLabel: string;
  dateRange: DateRange;
  availableFiliais: Filial[];
  selectedFiliais: string[];
  onDateChange: (range: DateRange) => void;
  onFiliaisChange: (keys: string[]) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {subtitle}
          {source === "not_configured" && <span className="ml-2 text-zinc-400">Mock</span>}
          {source === "magazord" && <span className="ml-2 text-zinc-400">Magazord</span>}
          {loading && <span className="ml-2 text-zinc-400">Atualizando...</span>}
          {updatedLabel && !loading && (
            <span className="ml-2 text-zinc-400">&middot; {updatedLabel}</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilialMultiSelect
          available={availableFiliais}
          selected={selectedFiliais}
          onChange={onFiliaisChange}
          loading={loading}
        />
        <DateRangePicker
          value={dateRange}
          onChange={onDateChange}
          loading={loading}
        />
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-700 disabled:opacity-30 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
