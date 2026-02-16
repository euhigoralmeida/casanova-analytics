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
import { analyzeDevices } from "./analyzers/device";
import { analyzeDemographics } from "./analyzers/demographic";
import { analyzeGeographic } from "./analyzers/geographic";

// Camada de dados
import { buildDataCube } from "./data-layer/cube-builder";
import { analyzeTrends } from "./data-layer/trend-analyzer";

// Camada cognitiva
import { computePacingProjections } from "./cognitive/pacing";
import { correlateFindings } from "./cognitive/correlation";

// Camada de estratégia
import { detectStrategicMode } from "./strategy/mode-detector";
import { detectBottleneck } from "./strategy/bottleneck";
import { rankDecisions } from "./strategy/ranker";
import { optimizeBudget } from "./strategy/budget-optimizer";

// Snapshot (dados históricos)
import { fetchHistoricalSnapshots } from "./snapshot";

// Camada de comunicação
import { generateExecutiveSummary } from "./communication/templates";

/**
 * Converte AnalysisContext legado para DataCube.
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
    devices: ctx.devices,
    demographics: ctx.demographics,
    geographic: ctx.geographic,
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
    rootCause: f.rootCause,
    relatedFindingIds: f.relatedFindingIds,
  };
}

/**
 * Calcula health score ponderado por impacto financeiro.
 */
function computeWeightedHealthScore(
  findings: CognitiveFinding[],
  modeScore: number,
  accountRevenue: number,
): number {
  let score = modeScore;

  const negativeImpact = findings
    .filter((f) => f.severity !== "success")
    .reduce((s, f) => s + Math.abs(f.financialImpact.netImpact), 0);

  const revenue = Math.max(accountRevenue, 1);
  const impactRatio = negativeImpact / revenue;

  score -= Math.min(impactRatio * 100, 40);

  const positiveCount = findings.filter((f) => f.severity === "success").length;
  score += Math.min(positiveCount * 3, 12);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Busca dados históricos e computa tendências para o DataCube.
 * Graceful degradation: retorna sem trends se falhar.
 */
async function enrichCubeWithTrends(cube: DataCube, tenantId: string): Promise<void> {
  try {
    // Buscar snapshots em paralelo: account + top 20 SKUs
    const skuSlice = cube.skus.slice(0, 20);
    const promises: Promise<{ scope: string; snaps: Array<{ date: string; metrics: Record<string, unknown> }> }>[] = [
      fetchHistoricalSnapshots(tenantId, "account", 30)
        .then((snaps) => ({ scope: "account", snaps })),
      ...skuSlice.map((s) =>
        fetchHistoricalSnapshots(tenantId, `sku:${s.sku}`, 30)
          .then((snaps) => ({ scope: `sku:${s.sku}`, snaps }))
      ),
    ];

    const results = await Promise.all(promises);

    // Separar account e SKU snapshots
    const accountResult = results.find((r) => r.scope === "account");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountSnaps = (accountResult?.snaps ?? []) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skuSnapsMap: Record<string, any> = {};
    for (const r of results) {
      if (r.scope.startsWith("sku:")) {
        const sku = r.scope.slice(4);
        skuSnapsMap[sku] = r.snaps;
      }
    }

    const trends = analyzeTrends(accountSnaps, skuSnapsMap);
    cube.trends = trends;

    // Enriquecer SkuSlices individuais
    for (const skuSlice of cube.skus) {
      if (trends.skus[skuSlice.sku]) {
        skuSlice.trend = trends.skus[skuSlice.sku];
      }
    }
  } catch (err) {
    console.error("Intelligence: trend analysis error (graceful degrade):", err);
  }
}

/**
 * Ponto de entrada principal do Motor Cognitivo.
 * Recebe AnalysisContext e retorna CognitiveResponse.
 * Async para suportar busca de dados históricos (trends).
 */
export async function analyzeCognitive(ctx: AnalysisContext): Promise<CognitiveResponse> {
  // 1. Construir DataCube enriquecido
  const cube = contextToCube(ctx);

  // 2. Buscar dados históricos e computar tendências
  await enrichCubeWithTrends(cube, ctx.tenantId);

  // 3. Rodar analyzers
  const allFindings: CognitiveFinding[] = [
    ...analyzePlanningGap(ctx, cube),
    ...analyzeEfficiency(ctx, cube),
    ...detectOpportunities(ctx, cube),
    ...evaluateRisks(ctx, cube),
    ...analyzeComposition(ctx, cube),
    ...analyzeDevices(ctx, cube),
    ...analyzeDemographics(ctx, cube),
    ...analyzeGeographic(ctx, cube),
  ];

  // 4. Correlacionar findings (identificar causas raiz)
  const correlated = correlateFindings(allFindings);

  // 5. Detectar modo estratégico (agora lê cube.trends)
  const mode = detectStrategicMode(cube);

  // 6. Detectar gargalo principal
  const bottleneck = detectBottleneck(cube);

  // 7. Otimizar alocação de budget
  const budgetPlan = optimizeBudget(cube);

  // 8. Rankear decisions por impacto financeiro
  const ranked = rankDecisions(correlated);

  // 9. Computar projeções de pacing
  const pacingProjections = computePacingProjections(cube);

  // 10. Health score ponderado
  const healthScore = computeWeightedHealthScore(
    correlated,
    mode.score,
    cube.account?.revenue ?? 0,
  );

  // 11. Gerar executive summary
  const executiveSummary = generateExecutiveSummary(mode, bottleneck, ranked, pacingProjections);

  // 12. Mapear para formatos legacy (backward compatibility)
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
    budgetPlan,
    accountTrend: cube.trends?.account,
    segmentation: (cube.devices || cube.demographics || cube.geographic) ? {
      devices: cube.devices ?? [],
      demographics: cube.demographics ?? [],
      geographic: cube.geographic ?? [],
    } : undefined,
    // Legacy
    insights: legacyInsights,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
