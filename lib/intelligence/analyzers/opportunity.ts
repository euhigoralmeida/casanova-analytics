import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import { quantifyUnderinvestment, ZERO_IMPACT } from "../cognitive/financial-impact";

/**
 * Detecta oportunidades perdidas: SKUs subinvestidos, canais subutilizados.
 */
export function detectOpportunities(ctx: AnalysisContext, _cube?: DataCube): CognitiveFinding[] {
  const { skus, account } = ctx;
  const findings: CognitiveFinding[] = [];

  if (!account || skus.length === 0) return findings;

  // 1. SKUs com ROAS alto mas budget limitado
  const totalAds = skus.reduce((s, sk) => s + sk.ads, 0);
  const avgSpend = totalAds / Math.max(skus.filter((s) => s.ads > 0).length, 1);

  const stars = skus.filter(
    (s) => s.roas > 8 && s.ads > 0 && s.ads < avgSpend * 0.5 && s.conversions >= 2
  );

  if (stars.length > 0) {
    const topStar = stars.sort((a, b) => b.roas - a.roas)[0];
    const fi = quantifyUnderinvestment(topStar.ads, avgSpend, topStar.roas);

    // Total opportunity across all stars
    const totalGain = stars.reduce((s, sk) => {
      const increase = Math.min(avgSpend - sk.ads, sk.ads * 2);
      return s + increase * sk.roas * 0.5;
    }, 0);

    findings.push({
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
      financialImpact: {
        ...fi,
        estimatedRevenueGain: Math.round(totalGain * 100) / 100,
        netImpact: Math.round(totalGain * 100) / 100,
        calculation: `${stars.length} SKUs subinvestidos: potencial de +${formatBRL(totalGain)} em receita`,
      },
    });
  }

  // 2. SKUs marcados como "escalar"
  const scalable = skus.filter((s) => s.status === "escalar");
  if (scalable.length > 0 && scalable.length <= 5) {
    const totalScalableRev = scalable.reduce((s, sk) => s + sk.revenue, 0);
    // Potencial: +20% de revenue nos SKUs escaláveis
    const potentialGain = totalScalableRev * 0.2;

    findings.push({
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
      financialImpact: {
        estimatedRevenueGain: Math.round(potentialGain * 100) / 100,
        estimatedCostSaving: 0,
        netImpact: Math.round(potentialGain * 100) / 100,
        confidence: 0.45,
        timeframe: "short",
        calculation: `+20% sobre ${formatBRL(totalScalableRev)} = +${formatBRL(potentialGain)}`,
      },
    });
  }

  // 3. Alto ROAS geral — oportunidade de crescimento
  if (account.roas > 8 && account.ads > 1000) {
    const potentialIncrease = account.ads * 0.2;
    // Com desconto de 30% por retorno decrescente
    const potentialGain = potentialIncrease * account.roas * 0.7;

    findings.push({
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
      financialImpact: {
        estimatedRevenueGain: Math.round(potentialGain * 100) / 100,
        estimatedCostSaving: 0,
        netImpact: Math.round(potentialGain * 100) / 100,
        confidence: 0.4,
        timeframe: "short",
        calculation: `+20% budget (${formatBRL(potentialIncrease)}) × ROAS ${account.roas.toFixed(1)} × 70% = +${formatBRL(potentialGain)}`,
      },
    });
  }

  return findings;
}
