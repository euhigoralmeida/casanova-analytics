/* =========================
   Cognitive Engine — Orquestrador do Motor Cognitivo
   Conecta todas as 4 camadas: Data → Cognitive → Strategy → Communication
========================= */

import type { DataCube } from "./data-layer/types";
import type { CognitiveFinding } from "./cognitive/types";
import type { CognitiveResponse } from "./communication/types";
import type { IntelligenceInsight, IntelligenceSummary, AnalysisContext } from "./types";

// Analyzers existentes (agora retornam CognitiveFinding com financialImpact)
import { analyzePlanningGap } from "./analyzers/planning-gap";
import { analyzeEfficiency } from "./analyzers/efficiency";
import { detectOpportunities } from "./analyzers/opportunity";
import { evaluateRisks } from "./analyzers/risk";
import { analyzeComposition } from "./analyzers/composition";

// Camada de dados
import { buildDataCube } from "./data-layer/cube-builder";

// Camada de estratégia
import { detectStrategicMode } from "./strategy/mode-detector";
import { detectBottleneck } from "./strategy/bottleneck";
import { rankDecisions } from "./strategy/ranker";

// Camada cognitiva
import { computePacingProjections } from "./cognitive/pacing";

// Camada de comunicação
import { generateExecutiveSummary } from "./communication/templates";

/**
 * Converte AnalysisContext legado para DataCube.
 * Usado para manter compatibilidade com os analyzers existentes.
 */
function contextToCube(ctx: AnalysisContext): DataCube {
  return buildDataCube({
    tenantId: ctx.tenantId,
    periodStart: ctx.periodStart,
    periodEnd: ctx.periodEnd,
    daysInPeriod: ctx.daysInPeriod,
    dayOfMonth: ctx.dayOfMonth,
    daysInMonth: ctx.daysInMonth,
    account: ctx.account,
    skus: ctx.skus,
    campaigns: ctx.campaigns,
    ga4: ctx.ga4,
    channels: ctx.channels,
    planning: ctx.planning,
  });
}

/**
 * Converte CognitiveFinding para IntelligenceInsight legacy.
 */
function findingToLegacyInsight(f: CognitiveFinding): IntelligenceInsight {
  return {
    id: f.id,
    category: f.category,
    severity: f.severity,
    title: f.title,
    description: f.description,
    metrics: f.metrics,
    recommendations: f.recommendations,
    source: f.source,
  };
}

/**
 * Calcula health score ponderado por impacto financeiro.
 * Substitui o health score ingênuo (100 - 15*danger - 8*warning).
 */
function computeWeightedHealthScore(
  findings: CognitiveFinding[],
  modeScore: number,
  accountRevenue: number,
): number {
  // Base do score vem do modo estratégico
  let score = modeScore;

  // Ajustar pelo impacto financeiro negativo como % da receita
  const negativeImpact = findings
    .filter((f) => f.severity !== "success")
    .reduce((s, f) => s + Math.abs(f.financialImpact.netImpact), 0);

  const revenue = Math.max(accountRevenue, 1);
  const impactRatio = negativeImpact / revenue;

  // Cada 10% de receita em risco = -10 pontos
  score -= Math.min(impactRatio * 100, 40);

  // Boost por findings positivos
  const positiveCount = findings.filter((f) => f.severity === "success").length;
  score += Math.min(positiveCount * 3, 12);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Ponto de entrada principal do Motor Cognitivo.
 * Recebe AnalysisContext (mesmo formato do engine antigo) e retorna CognitiveResponse.
 */
export function analyzeCognitive(ctx: AnalysisContext): CognitiveResponse {
  // 1. Construir DataCube enriquecido
  const cube = contextToCube(ctx);

  // 2. Rodar analyzers (agora retornam CognitiveFinding[])
  const allFindings: CognitiveFinding[] = [
    ...analyzePlanningGap(ctx, cube),
    ...analyzeEfficiency(ctx, cube),
    ...detectOpportunities(ctx, cube),
    ...evaluateRisks(ctx, cube),
    ...analyzeComposition(ctx, cube),
  ];

  // 3. Detectar modo estratégico
  const mode = detectStrategicMode(cube);

  // 4. Detectar gargalo principal
  const bottleneck = detectBottleneck(cube);

  // 5. Rankear decisions por impacto financeiro
  const ranked = rankDecisions(allFindings);

  // 6. Computar projeções de pacing
  const pacingProjections = computePacingProjections(cube);

  // 7. Health score ponderado
  const healthScore = computeWeightedHealthScore(
    allFindings,
    mode.score,
    cube.account?.revenue ?? 0,
  );

  // 8. Gerar executive summary
  const executiveSummary = generateExecutiveSummary(mode, bottleneck, ranked, pacingProjections);

  // 9. Mapear para formatos legacy (backward compatibility)
  const legacyInsights = ranked.slice(0, 12).map((r) => findingToLegacyInsight(r.finding));

  const topPriority = legacyInsights.find(
    (i) => i.severity === "danger" || i.severity === "warning"
  ) ?? null;

  const quickWins = legacyInsights
    .filter((i) => i.recommendations.some((r) => r.effort === "low" && r.impact !== "low"))
    .slice(0, 3);

  const summary: IntelligenceSummary = {
    healthScore,
    topPriority,
    quickWins,
  };

  return {
    // Cognitivo
    mode,
    bottleneck,
    healthScore,
    findings: ranked.slice(0, 15),
    pacingProjections,
    executiveSummary,
    // Legacy
    insights: legacyInsights,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
