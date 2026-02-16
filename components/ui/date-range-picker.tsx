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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const presets = getPresets();

  function selectPreset(p: typeof presets[number]) {
    const { start, end } = p.range();
    setSelStart(fmtDate(start));
    setSelEnd(fmtDate(end));
    setActivePreset(p.preset);
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
      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-zinc-600">Período</p>
        <button
          onClick={() => {
            if (!open) {
              setSelStart(props.value.startDate);
              setSelEnd(props.value.endDate);
              setActivePreset(props.value.preset ?? null);
              const d = new Date(props.value.startDate + "T12:00:00");
              setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
            }
            setOpen(!open);
          }}
          disabled={props.loading}
          className="mt-2 w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {props.value.label}
          </span>
          <svg className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 rounded-xl border bg-white shadow-xl flex flex-col sm:flex-row" style={{ width: "680px", maxWidth: "calc(100vw - 2rem)" }}>
          <div className="sm:w-44 border-b sm:border-b-0 sm:border-r py-2 shrink-0 flex sm:flex-col flex-wrap gap-0">
            {presets.map((p) => (
              <button
                key={p.preset}
                onClick={() => selectPreset(p)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                  activePreset === p.preset ? "bg-blue-50 text-blue-700 font-medium" : "text-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="border-t my-1" />
            <button
              onClick={() => {
                setActivePreset(null);
                setSelStart(null);
                setSelEnd(null);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                activePreset === null && selStart === null ? "bg-blue-50 text-blue-700 font-medium" : "text-zinc-700"
              }`}
            >
              Personalizado
            </button>
          </div>

          <div className="flex-1 min-w-0 p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 hover:bg-zinc-100 rounded">
                <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex gap-8 text-sm font-medium">
                <span>{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                <span>{MONTH_NAMES[month2.month]} {month2.year}</span>
              </div>
              <button onClick={nextMonth} className="p-1 hover:bg-zinc-100 rounded">
                <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-6">
              <CalendarMonth year={calMonth.year} month={calMonth.month} rangeStart={effectiveStart} rangeEnd={effectiveEnd} onDayClick={handleDayClick} />
              <CalendarMonth year={month2.year} month={month2.month} rangeStart={effectiveStart} rangeEnd={effectiveEnd} onDayClick={handleDayClick} />
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t">
              <input
                type="date"
                value={effectiveStart}
                onChange={(e) => { setSelStart(e.target.value); setActivePreset(null); }}
                className="rounded border px-2 py-1 text-sm flex-1"
              />
              <span className="text-zinc-400">—</span>
              <input
                type="date"
                value={effectiveEnd}
                onChange={(e) => { setSelEnd(e.target.value); setActivePreset(null); }}
                className="rounded border px-2 py-1 text-sm flex-1"
              />
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded transition-colors">
                Cancelar
              </button>
              <button
                onClick={applySelection}
                disabled={!selStart || !selEnd}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
