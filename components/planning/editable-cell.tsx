"use client";

import { useState, useRef, useCallback } from "react";
import type { PlanningRowFormat } from "@/types/api";

interface EditableCellProps {
  value: number | undefined;
  format: PlanningRowFormat;
  synced?: boolean;
  onChange: (value: number | undefined) => void;
}

function formatDisplay(value: number | undefined, format: PlanningRowFormat): string {
  if (value == null) return "";
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

function parseInput(raw: string, format: PlanningRowFormat): number | undefined {
  const cleaned = raw.replace(/[R$%.\s]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return undefined;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return undefined;
  if (format === "percent") return num / 100;
  return num;
}

function validateValue(value: number | undefined, format: PlanningRowFormat): string | null {
  if (value == null) return null;
  switch (format) {
    case "currency":
      if (value < 0) return "Valor não pode ser negativo";
      return null;
    case "percent":
      if (value < 0) return "Percentual não pode ser negativo";
      if (value > 1) return "Percentual não pode ser maior que 100%";
      return null;
    case "number":
    case "number2":
      if (value < 0) return "Valor não pode ser negativo";
      return null;
    default:
      return null;
  }
}

export function EditableCell({ value, format, synced, onChange }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(() => {
    setEditing(true);
    setValidationError(null);
    if (value != null) {
      if (format === "percent") {
        setRawValue((value * 100).toFixed(2).replace(".", ","));
      } else if (format === "currency" || format === "number2") {
        setRawValue(value.toFixed(2).replace(".", ","));
      } else {
        setRawValue(String(Math.round(value)));
      }
    } else {
      setRawValue("");
    }
  }, [value, format]);

  const handleBlur = useCallback(() => {
    const parsed = parseInput(rawValue, format);
    const error = validateValue(parsed, format);
    if (error) {
      setValidationError(error);
      // Keep editing so user can fix
      return;
    }
    setEditing(false);
    setValidationError(null);
    if (parsed !== value) {
      onChange(parsed);
    }
  }, [rawValue, format, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setEditing(false);
        setRawValue("");
        setValidationError(null);
      }
    },
    []
  );

  return (
    <td
      className={`border border-zinc-200 px-1 py-0.5 ${synced ? "bg-zinc-100" : ""}`}
      title={synced ? "Preenchido automaticamente via plataforma" : validationError ?? undefined}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={(e) => { setRawValue(e.target.value); setValidationError(null); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`w-full rounded bg-white px-1.5 py-0.5 text-right text-xs font-medium text-zinc-900 outline-none ring-2 ${
            validationError ? "ring-red-500" : "ring-blue-500"
          }`}
          title={validationError ?? undefined}
        />
      ) : (
        <button
          type="button"
          onClick={handleFocus}
          className="w-full rounded px-1.5 py-0.5 text-right text-xs text-zinc-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
        >
          {value != null ? formatDisplay(value, format) : ""}
        </button>
      )}
    </td>
  );
}
