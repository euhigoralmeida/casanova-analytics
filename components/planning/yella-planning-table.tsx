"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  YELLA_PLANNING_ROWS,
  YELLA_SECTIONS,
  computeYellaFullYear,
  type YellaRowDef,
  type YellaSectionDef,
} from "@/lib/planning-yella-calc";
import type { PlanningYearData, MonthlyValues, PlanningRowFormat } from "@/types/api";
import { EditableCell } from "./editable-cell";

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Metrics that are auto-synced from platforms */
const SYNCABLE_METRICS = new Set([
  "google_ads",
  "google_ads_faturamento",
  "google_ads_vendas",
  "meta_ads",
  "meta_ads_faturamento",
  "meta_ads_vendas",
  "usuarios_visitantes",
  "sessoes_totais",
  "sessoes_midia",
  "sessoes_organicas",
  "sessoes_engajadas",
  "taxa_rejeicao",
]);

type SourcesMap = Record<number, Record<string, string>>;

function formatDisplay(value: number | undefined | null, format: PlanningRowFormat): string {
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

// Group rows by section
function getRowsBySection(): { section: YellaSectionDef; rows: YellaRowDef[] }[] {
  const groups: { section: YellaSectionDef; rows: YellaRowDef[] }[] = [];
  let currentSection: string | null = null;

  for (const row of YELLA_PLANNING_ROWS) {
    if (row.section !== currentSection) {
      currentSection = row.section;
      const sectionDef = YELLA_SECTIONS.find((s) => s.id === row.section);
      if (sectionDef) {
        groups.push({ section: sectionDef, rows: [] });
      }
    }
    groups[groups.length - 1].rows.push(row);
  }

  return groups;
}

// Identify individual influencer rows (indent=2) for collapsing
const INFLU_INDIVIDUAL_KEYS = new Set(
  YELLA_PLANNING_ROWS
    .filter((r) => r.section === "influenciadores" && r.indent === 2)
    .map((r) => r.key)
);

interface YellaPlanningTableProps {
  data: PlanningYearData;
  sources?: SourcesMap;
  onCellChange: (month: number, metric: string, value: number | undefined) => void;
}

export function YellaPlanningTable({ data, sources, onCellChange }: YellaPlanningTableProps) {
  const { months, totals } = useMemo(() => computeYellaFullYear(data), [data]);
  const sectionGroups = useMemo(() => getRowsBySection(), []);
  const [influsExpanded, setInflusExpanded] = useState(false);
  const [influNames, setInfluNames] = useState<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load influencer names from DB on mount
  useEffect(() => {
    fetch("/api/planning/influ-names")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.names) setInfluNames(data.names);
      })
      .catch(() => { /* ignore */ });
  }, []);

  const handleNameChange = useCallback((labelKey: string, name: string) => {
    setInfluNames((prev) => {
      const next = { ...prev, [labelKey]: name };
      // Debounce save to DB (500ms)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/api/planning/influ-names", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: next }),
        }).catch(() => { /* ignore */ });
      }, 500);
      return next;
    });
  }, []);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="bg-zinc-800 text-white">
            <th className="sticky left-0 z-20 bg-zinc-800 px-3 py-2 text-left text-xs font-semibold min-w-[260px]">
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

        {/* Body: render section-by-section */}
        <tbody>
          {sectionGroups.map(({ section, rows }) => (
            <SectionBlock
              key={section.id}
              section={section}
              rows={rows}
              months={months}
              totals={totals}
              rawData={data}
              sources={sources}
              onCellChange={onCellChange}
              influsExpanded={influsExpanded}
              onToggleInflus={() => setInflusExpanded((prev) => !prev)}
              influNames={influNames}
              onNameChange={handleNameChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================
   Section rendering
========================= */

function SectionBlock({
  section,
  rows,
  months,
  totals,
  rawData,
  sources,
  onCellChange,
  influsExpanded,
  onToggleInflus,
  influNames,
  onNameChange,
}: {
  section: YellaSectionDef;
  rows: YellaRowDef[];
  months: Record<number, MonthlyValues>;
  totals: MonthlyValues;
  rawData: PlanningYearData;
  sources?: SourcesMap;
  onCellChange: (month: number, metric: string, value: number | undefined) => void;
  influsExpanded: boolean;
  onToggleInflus: () => void;
  influNames: Record<string, string>;
  onNameChange: (labelKey: string, name: string) => void;
}) {
  const isInfluSection = section.id === "influenciadores";

  return (
    <>
      {/* Section header row */}
      <tr>
        <td
          colSpan={14}
          className={`${section.color} ${section.textColor} px-3 py-1.5 text-xs font-bold tracking-wide ${
            isInfluSection ? "cursor-pointer select-none" : ""
          }`}
          onClick={isInfluSection ? onToggleInflus : undefined}
        >
          <span className="flex items-center gap-1.5">
            {isInfluSection && (
              influsExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
            )}
            {section.label}
          </span>
        </td>
      </tr>

      {/* Data rows */}
      {rows.map((row) => {
        // Skip individual influencer rows if collapsed
        if (isInfluSection && !influsExpanded && INFLU_INDIVIDUAL_KEYS.has(row.key)) {
          return null;
        }

        const isCalc = row.type === "calc";
        const isSyncable = !isCalc && SYNCABLE_METRICS.has(row.key);
        const indent = row.indent ?? 0;
        const paddingLeft = 12 + indent * 16; // px

        // Resolve label: if labelKey is set, use the saved name or placeholder
        let displayLabel = row.label;
        if (row.labelKey) {
          const savedName = influNames[row.labelKey];
          if (savedName) {
            displayLabel = `${savedName} (investimento)`;
          }
        }

        return (
          <tr
            key={row.key}
            className={`${
              isCalc ? "bg-amber-50" : isSyncable ? "bg-zinc-100" : "bg-white hover:bg-zinc-50"
            } border-b border-zinc-100`}
          >
            {/* Metric label */}
            <td
              className={`sticky left-0 z-10 border-r border-zinc-200 py-1 text-xs font-medium whitespace-nowrap ${
                isCalc ? "bg-amber-50 text-amber-900" : isSyncable ? "bg-zinc-100 text-zinc-700" : "bg-white text-zinc-800"
              }`}
              style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "12px" }}
              title={row.formula ?? undefined}
            >
              {row.labelKey ? (
                <EditableLabel
                  value={influNames[row.labelKey] ?? ""}
                  placeholder={row.labelPlaceholder ?? "Nome"}
                  onChange={(name) => onNameChange(row.labelKey!, name)}
                />
              ) : (
                <span className={`${row.formula ? "cursor-help border-b border-dashed border-amber-400" : ""} ${indent > 0 ? "text-zinc-600 italic" : ""}`}>
                  {displayLabel}
                </span>
              )}
            </td>

            {/* 12 month cells */}
            {MONTHS.map((_, i) => {
              const month = i + 1;
              const monthData: MonthlyValues = months[month] ?? {};

              if (isCalc) {
                const val = monthData[row.key];
                const isEmpty = val == null;
                return (
                  <td
                    key={month}
                    className="border border-zinc-200 px-1.5 py-0.5 text-right text-xs bg-amber-50 font-medium text-zinc-700"
                    title={isEmpty ? "Sem dados suficientes para cálculo" : undefined}
                  >
                    <span className={isEmpty ? "text-zinc-400" : ""}>
                      {formatDisplay(val, row.format)}
                    </span>
                  </td>
                );
              }

              return (
                <EditableCell
                  key={month}
                  value={rawData[month]?.[row.key]}
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
              {formatDisplay(totals[row.key], row.format)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

/* =========================
   Editable label for influencer name slots
========================= */

function EditableLabel({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = value || placeholder;

  const handleFocus = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
        className="w-full rounded bg-white px-1.5 py-0.5 text-xs font-medium text-zinc-900 outline-none ring-2 ring-purple-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleFocus}
      className={`text-left rounded px-1.5 py-0.5 text-xs font-medium hover:bg-purple-50 focus:bg-purple-50 focus:outline-none ${
        value ? "text-zinc-800" : "text-zinc-400 italic"
      }`}
      title="Clique para editar o nome"
    >
      {displayName} (investimento)
    </button>
  );
}
