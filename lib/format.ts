import type { KpiStatus } from "@/types/api";

/* =========================
   Formatação
========================= */
export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatPct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function fmtConv(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "0";
  if (Number.isInteger(rounded)) return rounded.toLocaleString("pt-BR");
  return rounded.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: Date): string {
  // Usar data local (não UTC) para evitar erro de +/- 1 dia
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/* =========================
   Helpers de status (KPI)
========================= */
export function roasStatus(v: number): KpiStatus {
  if (v < 5) return "danger";
  if (v < 7) return "warn";
  return "ok";
}

export function cpaStatus(v: number): KpiStatus {
  if (v === 0) return undefined;
  if (v > 80) return "danger";
  if (v > 60) return "warn";
  return "ok";
}

export function marginStatus(v: number): KpiStatus {
  if (v < 25) return "warn";
  return "ok";
}
