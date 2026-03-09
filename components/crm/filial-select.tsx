"use client";

import { useEffect, useRef, useState } from "react";
import { Store, ChevronDown, Check } from "lucide-react";
import type { Filial } from "./crm-hooks";

export function FilialMultiSelect({ available, selected, onChange, loading }: {
  available: Filial[];
  selected: string[];
  onChange: (keys: string[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (available.length === 0) return null;

  const allSelected = selected.length === 0;
  const label = allSelected
    ? "Todas as filiais"
    : selected.length === 1
      ? available.find((f) => f.key === selected[0])?.label || "1 filial"
      : `${selected.length} filiais`;

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    onChange(next);
  }

  function selectAll() {
    onChange([]);
  }

  function clearAll() {
    if (available.length > 0) onChange([available[0].key]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all disabled:opacity-50"
      >
        <Store className="w-4 h-4 text-zinc-500" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
            <span className="text-xs font-medium text-zinc-500">Filiais</span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className={`text-xs font-medium transition-colors ${allSelected ? "text-blue-600" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                Todas
              </button>
              <span className="text-zinc-200">|</span>
              <button
                onClick={clearAll}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {available.map((f) => {
              const isSelected = allSelected || selected.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggle(f.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-zinc-50 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-blue-600 border-blue-600" : "border-zinc-300"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 truncate text-zinc-700">{f.label}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">{f.orders.toLocaleString("pt-BR")}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
