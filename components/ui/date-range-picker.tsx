"use client";

import { useEffect, useRef, useState } from "react";
import type { DateRange } from "@/types/api";
import { getPresets, MONTH_NAMES } from "@/lib/constants";
import { fmtDate, fmtDateBR } from "@/lib/format";
import CalendarMonth from "./calendar-month";

export default function DateRangePicker(props: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(props.value.preset ?? null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const presets = getPresets();

  function selectPreset(p: typeof presets[number]) {
    const { start, end } = p.range();
    setSelStart(fmtDate(start));
    setSelEnd(fmtDate(end));
    setActivePreset(p.preset);
    // Navigate calendar to show the start date
    setCalMonth({ year: start.getFullYear(), month: start.getMonth() });
  }

  function applySelection() {
    if (!selStart || !selEnd) return;
    const s = selStart <= selEnd ? selStart : selEnd;
    const e = selStart <= selEnd ? selEnd : selStart;
    const preset = presets.find((p) => p.preset === activePreset);
    props.onChange({
      startDate: s,
      endDate: e,
      label: preset?.label ?? `${fmtDateBR(new Date(s + "T12:00:00"))} — ${fmtDateBR(new Date(e + "T12:00:00"))}`,
      preset: activePreset ?? undefined,
    });
    setOpen(false);
  }

  function handleDayClick(day: string) {
    setActivePreset(null);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(day);
      setSelEnd(null);
    } else {
      setSelEnd(day);
    }
  }

  function prevMonth() {
    setCalMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }

  function nextMonth() {
    setCalMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }

  const month2 = calMonth.month + 1 > 11
    ? { year: calMonth.year + 1, month: 0 }
    : { year: calMonth.year, month: calMonth.month + 1 };

  const effectiveStart = selStart && selEnd
    ? (selStart <= selEnd ? selStart : selEnd)
    : selStart ?? "";
  const effectiveEnd = selStart && selEnd
    ? (selStart <= selEnd ? selEnd : selStart)
    : selStart ?? "";

  return (
    <div className="relative" ref={ref}>
      {/* ─── Trigger Button ─── */}
      <button
        onClick={() => {
          if (!open) {
            setSelStart(props.value.startDate);
            setSelEnd(props.value.endDate);
            setActivePreset(props.value.preset ?? null);
            const d = new Date(props.value.startDate + "T12:00:00");
            // Show the month before end date so both months with selected dates are visible
            setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
          }
          setOpen(!open);
        }}
        disabled={props.loading}
        className="inline-flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all disabled:opacity-50"
      >
        <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{props.value.label}</span>
        <svg className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ─── Dropdown Panel ─── */}
      {open && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setOpen(false)} />

          <div className="fixed inset-x-4 bottom-4 top-auto z-50 sm:absolute sm:right-0 sm:left-auto sm:top-full sm:bottom-auto sm:inset-x-auto sm:mt-2 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden flex flex-col sm:flex-row" style={{ maxHeight: "calc(100vh - 2rem)" }}>

            {/* ─── Presets sidebar ─── */}
            <div className="sm:w-44 border-b sm:border-b-0 sm:border-r border-zinc-100 py-2 shrink-0 flex sm:flex-col flex-wrap overflow-y-auto max-h-32 sm:max-h-none">
              {presets.map((p) => (
                <button
                  key={p.preset}
                  onClick={() => selectPreset(p)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    activePreset === p.preset
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="border-t border-zinc-100 my-1 w-full" />
              <button
                onClick={() => {
                  setActivePreset(null);
                  setSelStart(null);
                  setSelEnd(null);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  activePreset === null && selStart === null
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                Personalizado
              </button>
            </div>

            {/* ─── Calendar area ─── */}
            <div className="flex-1 min-w-0 p-5 overflow-y-auto">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  aria-label="Mês anterior"
                >
                  <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex gap-12 text-sm font-semibold text-zinc-800">
                  <span>{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                  <span className="hidden sm:inline">{MONTH_NAMES[month2.month]} {month2.year}</span>
                </div>
                <button
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  aria-label="Próximo mês"
                >
                  <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Calendars: 1 on mobile, 2 on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <CalendarMonth
                  year={calMonth.year}
                  month={calMonth.month}
                  rangeStart={effectiveStart}
                  rangeEnd={effectiveEnd}
                  onDayClick={handleDayClick}
                />
                <div className="hidden sm:block">
                  <CalendarMonth
                    year={month2.year}
                    month={month2.month}
                    rangeStart={effectiveStart}
                    rangeEnd={effectiveEnd}
                    onDayClick={handleDayClick}
                  />
                </div>
              </div>

              {/* ─── Selection display + actions ─── */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-5 pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-zinc-400 font-medium">Início</label>
                    <input
                      type="date"
                      value={effectiveStart}
                      onChange={(e) => { setSelStart(e.target.value); setActivePreset(null); }}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                  <span className="text-zinc-300 text-lg">→</span>
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-zinc-400 font-medium">Fim</label>
                    <input
                      type="date"
                      value={effectiveEnd}
                      onChange={(e) => { setSelEnd(e.target.value); setActivePreset(null); }}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={applySelection}
                    disabled={!selStart || !selEnd}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
