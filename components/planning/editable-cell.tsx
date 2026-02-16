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

export function EditableCell({ value, format, synced, onChange }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(() => {
    setEditing(true);
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
    setEditing(false);
    const parsed = parseInput(rawValue, format);
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
      }
    },
    []
  );

  return (
    <td
      className={`border border-zinc-200 px-1 py-0.5 ${synced ? "bg-zinc-100" : ""}`}
      title={synced ? "Preenchido automaticamente via plataforma" : undefined}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={(e) => setRawValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full rounded bg-white px-1.5 py-0.5 text-right text-xs font-medium text-zinc-900 outline-none ring-2 ring-blue-500"
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
