/* =========================
   Pacing Projections
   Projeção de fim de mês baseada em taxa diária real.
========================= */

import type { PacingProjection } from "./types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";

/**
 * Projeta uma métrica para o fim do mês baseado na taxa diária atual.
 */
function projectMetric(params: {
  metric: string;
  label: string;
  currentValue: number;
  target: number;
  dayOfMonth: number;
  daysInMonth: number;
  isCurrency?: boolean;
}): PacingProjection | null {
  const { metric, label, currentValue, target, dayOfMonth, daysInMonth, isCurrency } = params;

  if (target <= 0 || dayOfMonth <= 0) return null;

  const dailyRate = currentValue / dayOfMonth;
  const remaining = daysInMonth - dayOfMonth;
  const projected = currentValue + dailyRate * remaining;
  const gap = target - projected;
  const dailyNeeded = remaining > 0 ? (target - currentValue) / remaining : 0;

  // Confidence based on how far into the month we are
  // More days = more data = higher confidence
  const confidence = Math.min(0.4 + (dayOfMonth / daysInMonth) * 0.5, 0.9);

  let scenario: PacingProjection["scenario"];
  const gapPct = target > 0 ? (gap / target) * 100 : 0;

  if (gapPct <= 0) scenario = "on_track";
  else if (gapPct <= 15) scenario = "at_risk";
  else scenario = "off_track";

  // Financial gap (in BRL) — only for revenue/investment metrics
  const projectedGapBRL = isCurrency ? gap : 0;

  return {
    metric,
    label,
    target: Math.round(target * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    projectedEndOfMonth: Math.round(projected * 100) / 100,
    projectedGap: Math.round(gap * 100) / 100,
    projectedGapBRL: Math.round(projectedGapBRL * 100) / 100,
    dailyRateNeeded: Math.round(dailyNeeded * 100) / 100,
    currentDailyRate: Math.round(dailyRate * 100) / 100,
    confidence,
    scenario,
  };
}

/**
 * Computa todas as projeções de pacing relevantes a partir do DataCube.
 */
export function computePacingProjections(cube: DataCube): PacingProjection[] {
  const { dayOfMonth, daysInMonth } = cube.meta;
  const { planning, account, ga4 } = cube;
  const projections: PacingProjection[] = [];

  // 1. Receita Captada
  if (planning.receita_captada && account) {
    const p = projectMetric({
      metric: "receita_captada",
      label: "Receita Captada",
      currentValue: account.revenue,
      target: planning.receita_captada,
      dayOfMonth,
      daysInMonth,
      isCurrency: true,
    });
    if (p) projections.push(p);
  }

  // 2. Investimento
  if (planning.investimento_ads && account) {
    const p = projectMetric({
      metric: "investimento",
      label: "Investimento Ads",
      currentValue: account.ads,
      target: planning.investimento_ads,
      dayOfMonth,
      daysInMonth,
      isCurrency: true,
    });
    if (p) projections.push(p);
  }

  // 3. Sessões
  if (planning.sessoes_totais && ga4) {
    const p = projectMetric({
      metric: "sessoes",
      label: "Sessões",
      currentValue: ga4.sessions,
      target: planning.sessoes_totais,
      dayOfMonth,
      daysInMonth,
    });
    if (p) projections.push(p);
  }

  // 4. Pedidos Captados
  if (planning.pedido_captado && account) {
    const p = projectMetric({
      metric: "pedidos",
      label: "Pedidos Captados",
      currentValue: account.conversions,
      target: planning.pedido_captado,
      dayOfMonth,
      daysInMonth,
    });
    if (p) projections.push(p);
  }

  return projections;
}

/**
 * Formata projeção como texto legível.
 */
export function formatProjection(p: PacingProjection): string {
  const scenarioLabel = {
    on_track: "no ritmo",
    at_risk: "em risco",
    off_track: "fora do ritmo",
  };

  if (p.projectedGapBRL !== 0) {
    return `${p.label}: projeção ${formatBRL(p.projectedEndOfMonth)} vs meta ${formatBRL(p.target)} — ${scenarioLabel[p.scenario]}`;
  }

  return `${p.label}: projeção ${Math.round(p.projectedEndOfMonth).toLocaleString("pt-BR")} vs meta ${Math.round(p.target).toLocaleString("pt-BR")} — ${scenarioLabel[p.scenario]}`;
}
