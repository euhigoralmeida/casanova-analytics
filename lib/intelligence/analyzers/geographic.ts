/* =========================
   Analyzer: Geográfico
   Regiões/estados — onde escalar, onde pausar
========================= */

import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import { quantifyConcentrationRisk, quantifyUnderinvestment, quantifyWastedSpend } from "../cognitive/financial-impact";

export function analyzeGeographic(_ctx: AnalysisContext, cube: DataCube): CognitiveFinding[] {
  const findings: CognitiveFinding[] = [];
  if (!cube.geographic || cube.geographic.length === 0) return findings;

  const regions = cube.geographic.filter((g) => g.costBRL > 50);
  if (regions.length < 2) return findings;

  const totalRevenue = regions.reduce((s, r) => s + r.revenue, 0);
  const totalSpend = regions.reduce((s, r) => s + r.costBRL, 0);
  const avgSpend = totalSpend / regions.length;

  // 1. Concentração geográfica: região com > 60% da receita
  const topRegion = regions[0]; // sorted by revenue desc in cube builder
  if (topRegion && totalRevenue > 0 && topRegion.revenueShare > 60) {
    findings.push({
      id: "geo-top-region",
      category: "risk",
      severity: "warning",
      title: `${topRegion.region} concentra ${topRegion.revenueShare.toFixed(0)}% da receita`,
      description: `Alta dependência geográfica. Se esta região sofrer queda, impacto será significativo na operação.`,
      metrics: { current: topRegion.revenueShare, target: 50, entityName: topRegion.region },
      recommendations: [{
        action: "Diversificar investimento para outras regiões com bom ROAS",
        impact: "medium",
        effort: "medium",
        steps: [
          `Aumentar budget em regiões secundárias com ROAS > 5`,
          `Criar campanhas geolocalizadas para regiões subexploradas`,
        ],
      }],
      source: "pattern",
      financialImpact: quantifyConcentrationRisk(topRegion.revenue, totalRevenue),
    });
  }

  // 2. Região com ROAS alto + share baixo (oportunidade de escalar)
  const scalable = regions.filter((r) => r.roas > 7 && r.revenueShare < 20 && r.conversions > 0);
  if (scalable.length > 0) {
    const best = scalable.sort((a, b) => b.roas - a.roas)[0];

    findings.push({
      id: "geo-scale-best",
      category: "opportunity",
      severity: "success",
      title: `${best.region} com ROAS ${best.roas.toFixed(1)} e apenas ${best.revenueShare.toFixed(0)}% da receita`,
      description: `Região com excelente retorno mas baixo investimento. Escalar pode gerar receita incremental com eficiência.`,
      metrics: { current: best.revenueShare, target: 20, entityName: best.region },
      recommendations: [{
        action: `Aumentar investimento em ${best.region} em 30-50%`,
        impact: "high",
        effort: "low",
      }],
      source: "pattern",
      financialImpact: quantifyUnderinvestment(best.costBRL, avgSpend, best.roas),
    });
  }

  // 3. Região com ROAS < 3 + spend > R$200 (desperdício)
  const wasteful = regions.filter((r) => r.roas < 3 && r.costBRL > 200);
  if (wasteful.length > 0) {
    const worst = wasteful.sort((a, b) => a.roas - b.roas)[0];

    findings.push({
      id: "geo-pause-worst",
      category: "efficiency",
      severity: "warning",
      title: `${worst.region} gastando ${formatBRL(worst.costBRL)} com ROAS ${worst.roas.toFixed(1)}`,
      description: `Região com baixo retorno. Reduzir investimento e realocar para regiões mais eficientes.`,
      metrics: { current: worst.roas, target: 5, entityName: worst.region },
      recommendations: [{
        action: `Reduzir investimento em ${worst.region} em 50%`,
        impact: "medium",
        effort: "low",
      }],
      source: "pattern",
      financialImpact: quantifyWastedSpend(worst.costBRL * 0.5),
    });
  }

  return findings;
}
