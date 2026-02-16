import type {
  AnalysisContext,
  IntelligenceInsight,
  IntelligenceResponse,
  IntelligenceSummary,
} from "./types";
import { analyzePlanningGap } from "./analyzers/planning-gap";
import { analyzeEfficiency } from "./analyzers/efficiency";
import { detectOpportunities } from "./analyzers/opportunity";
import { evaluateRisks } from "./analyzers/risk";
import { analyzeComposition } from "./analyzers/composition";

const SEVERITY_SCORE: Record<string, number> = {
  danger: 0,
  warning: 1,
  success: 2,
};

/**
 * Core Intelligence Engine — runs all analyzers and produces
 * a prioritized list of insights with health score.
 */
export function analyze(ctx: AnalysisContext): IntelligenceResponse {
  // Run all analyzers (sync — they're CPU-only, no I/O)
  const allInsights: IntelligenceInsight[] = [
    ...analyzePlanningGap(ctx),
    ...analyzeEfficiency(ctx),
    ...detectOpportunities(ctx),
    ...evaluateRisks(ctx),
    ...analyzeComposition(ctx),
  ];

  // Sort by severity (danger first, then warning, then success)
  allInsights.sort(
    (a, b) => (SEVERITY_SCORE[a.severity] ?? 2) - (SEVERITY_SCORE[b.severity] ?? 2)
  );

  // Limit to 12 insights max
  const insights = allInsights.slice(0, 12);

  // Compute health score
  const summary = computeSummary(insights);

  return {
    insights,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

function computeSummary(insights: IntelligenceInsight[]): IntelligenceSummary {
  // Health score: start at 100, subtract for negatives
  let score = 100;

  for (const i of insights) {
    if (i.severity === "danger") score -= 15;
    else if (i.severity === "warning") score -= 8;
    else if (i.severity === "success") score += 2;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Top priority = first danger or warning insight
  const topPriority =
    insights.find((i) => i.severity === "danger" || i.severity === "warning") ?? null;

  // Quick wins = insights with at least one low-effort recommendation
  const quickWins = insights.filter((i) =>
    i.recommendations.some((r) => r.effort === "low" && r.impact !== "low")
  ).slice(0, 3);

  return { healthScore: score, topPriority, quickWins };
}
