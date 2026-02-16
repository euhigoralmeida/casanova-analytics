import type { AnalysisContext, IntelligenceInsight } from "../types";
import { formatBRL } from "@/lib/format";

/**
 * Detecta oportunidades perdidas: SKUs subinvestidos, canais subutilizados.
 */
export function detectOpportunities(ctx: AnalysisContext): IntelligenceInsight[] {
  const { skus, account } = ctx;
  const insights: IntelligenceInsight[] = [];

  if (!account || skus.length === 0) return insights;

  // 1. SKUs com ROAS alto mas budget limitado (stars subinvestidas)
  const totalAds = skus.reduce((s, sk) => s + sk.ads, 0);
  const avgSpend = totalAds / Math.max(skus.filter((s) => s.ads > 0).length, 1);

  const stars = skus.filter(
    (s) => s.roas > 8 && s.ads > 0 && s.ads < avgSpend * 0.5 && s.conversions >= 2
  );

  if (stars.length > 0) {
    const topStar = stars.sort((a, b) => b.roas - a.roas)[0];
    insights.push({
      id: "opp-underinvested",
      category: "opportunity",
      severity: "success",
      title: `${stars.length} SKU(s) com alto ROAS e baixo investimento`,
      description: `${topStar.nome} tem ROAS ${topStar.roas.toFixed(1)} mas gasto de apenas ${formatBRL(topStar.ads)} (média: ${formatBRL(avgSpend)}).`,
      metrics: { current: topStar.roas, entityName: topStar.nome },
      recommendations: [{
        action: `Aumentar budget de "${topStar.nome}" (ROAS ${topStar.roas.toFixed(1)})`,
        impact: "high",
        effort: "low",
        steps: stars.slice(0, 3).map((s) => `Escalar "${s.nome}" — ROAS ${s.roas.toFixed(1)}, gasto ${formatBRL(s.ads)}`),
      }],
      source: "pattern",
    });
  }

  // 2. SKUs marcados como "escalar" — reforçar oportunidade
  const scalable = skus.filter((s) => s.status === "escalar");
  if (scalable.length > 0 && scalable.length <= 5) {
    const totalScalableRev = scalable.reduce((s, sk) => s + sk.revenue, 0);
    insights.push({
      id: "opp-scalable",
      category: "opportunity",
      severity: "success",
      title: `${scalable.length} SKU(s) com potencial de escalar`,
      description: `SKUs com ROAS saudável, margem boa e estoque: ${scalable.map((s) => s.nome).join(", ")}. Revenue combinado: ${formatBRL(totalScalableRev)}.`,
      metrics: { current: totalScalableRev },
      recommendations: [{
        action: "Aumentar investimento nos SKUs com status 'Escalar'",
        impact: "high",
        effort: "low",
      }],
      source: "pattern",
    });
  }

  // 3. Alto ROAS geral — oportunidade de crescimento
  if (account.roas > 8 && account.ads > 1000) {
    insights.push({
      id: "opp-growth",
      category: "opportunity",
      severity: "success",
      title: `ROAS geral de ${account.roas.toFixed(1)} — margem para crescer`,
      description: `Com ROAS acima de 8, há espaço para aumentar investimento mantendo rentabilidade. Considere testar novos públicos ou criativos.`,
      metrics: { current: account.roas },
      recommendations: [{
        action: "Testar aumento de 20% no budget total",
        impact: "medium",
        effort: "low",
      }],
      source: "pattern",
    });
  }

  return insights;
}
