import type { AnalysisContext, IntelligenceInsight } from "../types";
import { formatBRL } from "@/lib/format";

/**
 * Identifica desperdício de investimento em campanhas e SKUs.
 */
export function analyzeEfficiency(ctx: AnalysisContext): IntelligenceInsight[] {
  const { campaigns, skus, account } = ctx;
  const insights: IntelligenceInsight[] = [];

  if (!account || account.ads === 0) return insights;

  // 1. Campanhas com alto gasto + baixo ROAS
  const wasteful = campaigns.filter(
    (c) => c.costBRL > 500 && c.roas < 3 && c.conversions > 0
  );
  const zeroConv = campaigns.filter(
    (c) => c.costBRL > 200 && c.conversions === 0
  );

  if (zeroConv.length > 0) {
    const totalWaste = zeroConv.reduce((s, c) => s + c.costBRL, 0);
    insights.push({
      id: "eff-zero-conv",
      category: "efficiency",
      severity: "danger",
      title: `${zeroConv.length} campanha(s) sem conversão gastando ${formatBRL(totalWaste)}`,
      description: `Campanhas: ${zeroConv.slice(0, 3).map((c) => c.campaignName).join(", ")}${zeroConv.length > 3 ? ` e mais ${zeroConv.length - 3}` : ""}.`,
      metrics: { current: totalWaste, entityName: zeroConv[0].campaignName },
      recommendations: [{
        action: "Pausar campanhas sem conversão imediatamente",
        impact: "high",
        effort: "low",
        steps: zeroConv.slice(0, 3).map((c) => `Pausar "${c.campaignName}" (${formatBRL(c.costBRL)} gastos)`),
      }],
      source: "pattern",
    });
  }

  if (wasteful.length > 0) {
    const totalWaste = wasteful.reduce((s, c) => s + c.costBRL, 0);
    const avgRoas = wasteful.reduce((s, c) => s + c.roas, 0) / wasteful.length;
    insights.push({
      id: "eff-low-roas-camp",
      category: "efficiency",
      severity: "warning",
      title: `${formatBRL(totalWaste)} investidos em campanhas com ROAS < 3`,
      description: `${wasteful.length} campanha(s) com ROAS médio de ${avgRoas.toFixed(1)}. Considere redistribuir orçamento.`,
      metrics: { current: avgRoas, target: 5, gap: ((avgRoas - 5) / 5) * 100 },
      recommendations: [{
        action: "Redistribuir budget para campanhas com ROAS > 7",
        impact: "high",
        effort: "medium",
        steps: wasteful.slice(0, 3).map((c) => `Reduzir budget de "${c.campaignName}" (ROAS ${c.roas.toFixed(1)})`),
      }],
      source: "pattern",
    });
  }

  // 2. SKUs com alto CPA
  const highCpaSKUs = skus.filter((s) => s.cpa > 80 && s.ads > 300);
  if (highCpaSKUs.length > 0) {
    const worst = highCpaSKUs.sort((a, b) => b.cpa - a.cpa)[0];
    insights.push({
      id: "eff-high-cpa-sku",
      category: "efficiency",
      severity: "warning",
      title: `${highCpaSKUs.length} SKU(s) com CPA acima de R$ 80`,
      description: `Pior: ${worst.nome} com CPA de ${formatBRL(worst.cpa)} e ROAS ${worst.roas.toFixed(1)}.`,
      metrics: { current: worst.cpa, target: 80, entityName: worst.nome },
      recommendations: [{
        action: `Revisar anúncios do SKU ${worst.sku}`,
        impact: "medium",
        effort: "medium",
      }],
      source: "pattern",
    });
  }

  // 3. Budget mal distribuído
  if (skus.length > 3) {
    const totalAds = skus.reduce((s, sk) => s + sk.ads, 0);
    const lowRoasSKUs = skus.filter((s) => s.roas < 5 && s.ads > 0);
    const lowRoasSpend = lowRoasSKUs.reduce((s, sk) => s + sk.ads, 0);
    const pct = totalAds > 0 ? (lowRoasSpend / totalAds) * 100 : 0;

    if (pct > 40) {
      insights.push({
        id: "eff-budget-dist",
        category: "efficiency",
        severity: "warning",
        title: `${pct.toFixed(0)}% do investimento em SKUs com ROAS < 5`,
        description: `${formatBRL(lowRoasSpend)} de ${formatBRL(totalAds)} estão em ${lowRoasSKUs.length} SKUs com baixo retorno.`,
        metrics: { current: pct, target: 20, gap: pct - 20 },
        recommendations: [{
          action: "Redistribuir orçamento para SKUs com ROAS > 7",
          impact: "high",
          effort: "medium",
        }],
        source: "pattern",
      });
    }
  }

  return insights;
}
