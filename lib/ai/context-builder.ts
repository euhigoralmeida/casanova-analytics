// Builds context summaries for AI prompts from CognitiveResponse data

import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
import { formatBRL } from "@/lib/format";

/**
 * Serializes CognitiveResponse into a compact text summary for the LLM system prompt.
 * Keeps it under ~2k tokens.
 */
export function buildContextSummary(response: CognitiveResponse): string {
  const lines: string[] = [];

  // Mode
  lines.push(`## Modo Estratégico: ${response.mode.mode} (score ${response.mode.score}/100)`);
  lines.push(`Descrição: ${response.mode.description}`);
  lines.push("");

  // Bottleneck
  lines.push(`## Gargalo Principal: ${response.bottleneck.constraint}`);
  lines.push(`Severidade: ${response.bottleneck.severity} | Impacto: ${formatBRL(response.bottleneck.financialImpact.netImpact)}`);
  lines.push(`Ação: ${response.bottleneck.unlockAction}`);
  lines.push("");

  // Health Score
  lines.push(`## Health Score: ${response.healthScore}/100`);
  lines.push("");

  // Top Findings (max 5)
  const topFindings = response.findings.slice(0, 5);
  if (topFindings.length > 0) {
    lines.push("## Top Findings Priorizados");
    for (const rd of topFindings) {
      const f = rd.finding;
      const impact = rd.components.impactBRL ? ` | Impacto: ${formatBRL(rd.components.impactBRL)}` : "";
      lines.push(`- [${f.severity}] ${f.title}${impact}`);
      lines.push(`  ${f.description}`);
      if (f.recommendations?.length) {
        lines.push(`  Ação: ${f.recommendations[0].action}`);
      }
    }
    lines.push("");
  }

  // Pacing
  if (response.pacingProjections.length > 0) {
    lines.push("## Pacing de Metas (mês corrente)");
    for (const p of response.pacingProjections) {
      const pct = p.target > 0 ? Math.round((p.currentValue / p.target) * 100) : 0;
      const status = p.scenario === "on_track" ? "ON TRACK" : p.scenario === "at_risk" ? "RISCO" : "FORA";
      lines.push(`- ${p.label}: Atual ${p.currentValue.toFixed(0)} / Meta ${p.target.toFixed(0)} (${pct}%) → ${status}`);
    }
    lines.push("");
  }

  // Executive Summary
  lines.push(`## Resumo Executivo`);
  lines.push(`Headline: ${response.executiveSummary.headline}`);
  lines.push(`Ação Prioritária: ${response.executiveSummary.topAction}`);
  for (const m of response.executiveSummary.keyMetrics) {
    lines.push(`- ${m.label}: ${m.value} [${m.status}]`);
  }

  return lines.join("\n");
}

/**
 * Builds period context from dates.
 */
export function buildPeriodContext(startDate: string, endDate: string): string {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const sd = new Date(startDate);
  const ed = new Date(endDate);
  const periodDays = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;

  return [
    `Período analisado: ${startDate} a ${endDate} (${periodDays} dias)`,
    `Hoje: dia ${dayOfMonth}/${daysInMonth} do mês (${daysRemaining} dias restantes)`,
  ].join("\n");
}
