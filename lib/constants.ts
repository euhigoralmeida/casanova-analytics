import type { DateRange } from "@/types/api";
import { fmtDate } from "@/lib/format";

/* =========================
   Cores / Estilos de alertas
========================= */
export const alertColors = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

export const smartAlertStyles: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  danger: { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", icon: "⚠" },
  warn: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", icon: "⚡" },
  info: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", icon: "ℹ" },
  success: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800", icon: "✓" },
};

export const categoryLabels: Record<string, string> = {
  account: "Conta",
  campaign: "Campanha",
  sku: "SKU",
  trend: "Tendência",
};

/* =========================
   Channel badges
========================= */
export const channelColors: Record<string, string> = {
  SHOPPING: "bg-emerald-100 text-emerald-800",
  PERFORMANCE_MAX: "bg-blue-100 text-blue-800",
  SEARCH: "bg-purple-100 text-purple-800",
  DISPLAY: "bg-orange-100 text-orange-800",
  VIDEO: "bg-red-100 text-red-800",
  DISCOVERY: "bg-cyan-100 text-cyan-800",
};

export const channelLabels: Record<string, string> = {
  SHOPPING: "Shopping",
  PERFORMANCE_MAX: "PMax",
  SEARCH: "Search",
  DISPLAY: "Display",
  VIDEO: "Video",
  DISCOVERY: "Discovery",
};

/* =========================
   Presets de período
========================= */
// Presets alinhados com o Google Ads:
// - "Últimos 7 dias" = hoje - 6 até hoje (7 dias incluindo hoje)
export function getPresets(): { label: string; preset: string; range: () => { start: Date; end: Date } }[] {
  return [
    {
      label: "Hoje",
      preset: "today",
      range: () => {
        const d = new Date();
        return { start: d, end: d };
      },
    },
    {
      label: "Ontem",
      preset: "yesterday",
      range: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { start: new Date(d), end: new Date(d) };
      },
    },
    {
      label: "Últimos 7 dias",
      preset: "7d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        return { start, end };
      },
    },
    {
      label: "Últimos 14 dias",
      preset: "14d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 13);
        return { start, end };
      },
    },
    {
      label: "Últimos 30 dias",
      preset: "30d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return { start, end };
      },
    },
    {
      label: "Este mês",
      preset: "this_month",
      range: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
      },
    },
    {
      label: "Mês passado",
      preset: "last_month",
      range: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end };
      },
    },
    {
      label: "Últimos 60 dias",
      preset: "60d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 59);
        return { start, end };
      },
    },
    {
      label: "Últimos 90 dias",
      preset: "90d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 89);
        return { start, end };
      },
    },
  ];
}

export function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: fmtDate(start), endDate: fmtDate(end), label: "Últimos 7 dias", preset: "7d" };
}

/* =========================
   Helpers do calendário
========================= */
export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}
