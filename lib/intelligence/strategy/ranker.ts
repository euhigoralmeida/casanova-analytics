/* =========================
   Decision Ranker
   Ordena findings por score: (impacto R$) × (confiança) × (urgência) ÷ (esforço)
========================= */

import type { CognitiveFinding, RankedDecision } from "../cognitive/types";

const URGENCY_BY_SEVERITY: Record<string, number> = {
  danger: 3,
  warning: 2,
  success: 1,
};

const EFFORT_BY_LEVEL: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Rankeia findings cognitivos por score de prioridade.
 *
 * Score = |netImpact| × confidence × urgency ÷ avgEffort
 *
 * Findings com impacto financeiro maior, maior confiança,
 * maior urgência e menor esforço ficam no topo.
 */
export function rankDecisions(findings: CognitiveFinding[]): RankedDecision[] {
  const scored = findings.map((finding) => {
    const impactBRL = Math.abs(finding.financialImpact.netImpact);
    const confidence = finding.financialImpact.confidence;
    const urgency = URGENCY_BY_SEVERITY[finding.severity] ?? 1;

    // Avg effort of recommendations (default: medium)
    const efforts = finding.recommendations.map((r) => EFFORT_BY_LEVEL[r.effort] ?? 2);
    const avgEffort = efforts.length > 0
      ? efforts.reduce((s, e) => s + e, 0) / efforts.length
      : 2;

    // Score formula: higher is better
    const score = avgEffort > 0
      ? (impactBRL * confidence * urgency) / avgEffort
      : 0;

    return {
      rank: 0, // will be set after sorting
      finding,
      score: Math.round(score * 100) / 100,
      components: {
        impactBRL: Math.round(impactBRL * 100) / 100,
        confidence,
        urgency,
        effort: avgEffort,
      },
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Assign ranks
  scored.forEach((d, i) => { d.rank = i + 1; });

  return scored;
}
