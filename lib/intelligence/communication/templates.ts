/* =========================
   Communication Templates (PT-BR)
   Gera narrativas estruturadas a partir dos dados cognitivos.
========================= */

import type { ExecutiveSummaryData } from "./types";
import type { ModeAssessment, Bottleneck, RankedDecision, PacingProjection } from "../cognitive/types";
import { formatBRL } from "@/lib/format";

const MODE_LABELS: Record<string, string> = {
  ESCALAR: "Escalar",
  OTIMIZAR: "Otimizar",
  PROTEGER: "Proteger",
  REESTRUTURAR: "Reestruturar",
};

const BOTTLENECK_LABELS: Record<string, string> = {
  traffic: "Tráfego",
  conversion: "Conversão",
  aov: "Ticket Médio",
  margin: "Margem",
  budget: "Orçamento",
};

/**
 * Gera o headline do executive summary.
 */
export function generateHeadline(mode: ModeAssessment, bottleneck: Bottleneck): string {
  const modeLabel = MODE_LABELS[mode.mode] ?? mode.mode;
  const bottleneckLabel = BOTTLENECK_LABELS[bottleneck.constraint] ?? bottleneck.constraint;

  return `Modo: ${modeLabel} — Gargalo principal: ${bottleneckLabel}`;
}

/**
 * Gera a ação principal recomendada.
 */
export function generateTopAction(findings: RankedDecision[]): string {
  if (findings.length === 0) return "Sem ações prioritárias no momento";

  const top = findings[0];
  const impact = top.finding.financialImpact;

  if (impact.netImpact > 0) {
    return `${top.finding.recommendations[0]?.action ?? top.finding.title} — impacto estimado: ${formatBRL(impact.netImpact)}/mês`;
  }

  return top.finding.recommendations[0]?.action ?? top.finding.title;
}

/**
 * Gera os key metrics para exibição.
 */
export function generateKeyMetrics(
  mode: ModeAssessment,
  findings: RankedDecision[],
  pacing: PacingProjection[],
): ExecutiveSummaryData["keyMetrics"] {
  const metrics: ExecutiveSummaryData["keyMetrics"] = [];

  // Score do modo
  metrics.push({
    label: "Score Estratégico",
    value: `${mode.score}/100`,
    status: mode.score >= 75 ? "ok" : mode.score >= 50 ? "warn" : "danger",
  });

  // Pacing de receita
  const revPacing = pacing.find((p) => p.metric === "receita_captada");
  if (revPacing) {
    metrics.push({
      label: "Projeção Receita",
      value: formatBRL(revPacing.projectedEndOfMonth),
      status: revPacing.scenario === "on_track" ? "ok" : revPacing.scenario === "at_risk" ? "warn" : "danger",
    });
  }

  // Total de impacto financeiro identificado
  const totalPositiveImpact = findings
    .filter((f) => f.finding.financialImpact.netImpact > 0)
    .reduce((s, f) => s + f.finding.financialImpact.netImpact, 0);

  if (totalPositiveImpact > 0) {
    metrics.push({
      label: "Oportunidade Total",
      value: formatBRL(totalPositiveImpact),
      status: "ok",
    });
  }

  // Total de risco identificado
  const totalRisk = findings
    .filter((f) => f.finding.severity === "danger")
    .reduce((s, f) => s + Math.abs(f.finding.financialImpact.netImpact), 0);

  if (totalRisk > 0) {
    metrics.push({
      label: "Risco Identificado",
      value: formatBRL(totalRisk),
      status: "danger",
    });
  }

  return metrics;
}

/**
 * Gera o ExecutiveSummaryData completo.
 */
export function generateExecutiveSummary(
  mode: ModeAssessment,
  bottleneck: Bottleneck,
  findings: RankedDecision[],
  pacing: PacingProjection[],
): ExecutiveSummaryData {
  return {
    headline: generateHeadline(mode, bottleneck),
    topAction: generateTopAction(findings),
    keyMetrics: generateKeyMetrics(mode, findings, pacing),
  };
}
