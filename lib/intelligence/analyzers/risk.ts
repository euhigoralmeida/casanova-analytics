import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import {
  quantifyPauseSkus,
  quantifyBounceImpact,
  quantifyCartAbandonmentImpact,
  quantifyConcentrationRisk,
  ZERO_IMPACT,
} from "../cognitive/financial-impact";

/**
 * Avalia tendências de risco e padrões negativos.
 */
export function evaluateRisks(ctx: AnalysisContext, cube?: DataCube): CognitiveFinding[] {
  const { skus, account, ga4 } = ctx;
  const findings: CognitiveFinding[] = [];

  if (!account) return findings;

  // 1. ROAS geral abaixo do limite de pausa
  if (account.ads > 500 && account.roas < 5) {
    // Quanto de gasto é "desperdiçado" com ROAS < 5?
    const lostRevenue = account.ads * (5 - account.roas); // revenue gap vs breakeven

    findings.push({
      id: "risk-roas-critical",
      category: "risk",
      severity: "danger",
      title: `ROAS geral em ${account.roas.toFixed(1)} — abaixo do limite de pausa (5.0)`,
      description: `Investimento de ${formatBRL(account.ads)} gerando revenue de ${formatBRL(account.revenue)}. Risco de operação deficitária.`,
      metrics: { current: account.roas, target: 5 },
      recommendations: [{
        action: "Revisão urgente de todas as campanhas",
        impact: "high",
        effort: "high",
        steps: [
          "Pausar campanhas com ROAS < 3",
          "Reduzir lances em 20% nas campanhas restantes",
          "Focar budget nos top 5 SKUs por ROAS",
        ],
      }],
      source: "pattern",
      financialImpact: {
        estimatedRevenueGain: Math.round(Math.max(lostRevenue, 0) * 100) / 100,
        estimatedCostSaving: 0,
        netImpact: Math.round(Math.max(lostRevenue, 0) * 100) / 100,
        confidence: 0.6,
        timeframe: "immediate",
        calculation: `ROAS de ${account.roas.toFixed(1)} vs breakeven 5.0: gap de ${formatBRL(Math.max(lostRevenue, 0))} em receita`,
      },
    });
  }

  // 2. SKUs que precisam ser pausados
  const toPause = skus.filter((s) => s.status === "pausar");
  if (toPause.length > 0) {
    const wastedAds = toPause.reduce((s, sk) => s + sk.ads, 0);
    if (wastedAds > 500) {
      const avgRoas = toPause.reduce((s, sk) => s + sk.roas * sk.ads, 0) / Math.max(wastedAds, 1);

      findings.push({
        id: "risk-pause-skus",
        category: "risk",
        severity: "warning",
        title: `${toPause.length} SKU(s) precisam ser pausados — ${formatBRL(wastedAds)} em risco`,
        description: `SKUs com performance abaixo do limite: ${toPause.slice(0, 3).map((s) => s.nome).join(", ")}.`,
        metrics: { current: wastedAds, entityName: toPause[0].nome },
        recommendations: [{
          action: "Pausar anúncios dos SKUs com status 'Pausar'",
          impact: "high",
          effort: "low",
          steps: toPause.slice(0, 3).map((s) => `Pausar "${s.nome}" (ROAS ${s.roas.toFixed(1)}, CPA ${formatBRL(s.cpa)})`),
        }],
        source: "pattern",
        financialImpact: quantifyPauseSkus(wastedAds, avgRoas),
      });
    }
  }

  // 3. Bounce rate alto
  if (ga4 && ga4.bounceRate > 0.55) {
    const fi = cube ? quantifyBounceImpact(cube) : ZERO_IMPACT;

    findings.push({
      id: "risk-bounce",
      category: "risk",
      severity: ga4.bounceRate > 0.65 ? "danger" : "warning",
      title: `Taxa de rejeição em ${(ga4.bounceRate * 100).toFixed(1)}%`,
      description: `Mais da metade dos visitantes saem sem interagir. Pode indicar problemas de experiência, velocidade ou relevância do tráfego.`,
      metrics: { current: ga4.bounceRate, target: 0.45 },
      recommendations: [{
        action: "Melhorar experiência da landing page",
        impact: "high",
        effort: "high",
        steps: ["Testar velocidade de carregamento", "Revisar relevância dos anúncios vs landing page", "Melhorar CTA acima da dobra"],
      }],
      source: "pattern",
      financialImpact: fi,
    });
  }

  // 4. Abandono de carrinho alto
  if (ga4 && ga4.cartAbandonmentRate > 75) {
    const fi = cube ? quantifyCartAbandonmentImpact(cube) : ZERO_IMPACT;

    findings.push({
      id: "risk-cart-abandon",
      category: "risk",
      severity: ga4.cartAbandonmentRate > 85 ? "danger" : "warning",
      title: `Abandono de carrinho em ${ga4.cartAbandonmentRate.toFixed(1)}%`,
      description: `A maioria dos clientes que adicionam ao carrinho não completam a compra. Investigue checkout, frete e pagamento.`,
      metrics: { current: ga4.cartAbandonmentRate, target: 70 },
      recommendations: [{
        action: "Otimizar funil de checkout",
        impact: "high",
        effort: "medium",
        steps: ["Simplificar etapas de checkout", "Oferecer frete grátis acima de X", "Adicionar mais opções de pagamento"],
      }],
      source: "pattern",
      financialImpact: fi,
    });
  }

  // 5. Concentração de receita
  if (skus.length > 5) {
    const sorted = [...skus].sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((s, sk) => s + sk.revenue, 0);
    if (totalRev > 0) {
      const top1Pct = (sorted[0].revenue / totalRev) * 100;
      if (top1Pct > 50) {
        findings.push({
          id: "risk-concentration",
          category: "risk",
          severity: "warning",
          title: `${top1Pct.toFixed(0)}% da receita vem de 1 SKU`,
          description: `"${sorted[0].nome}" representa mais da metade do faturamento. Risco alto se este produto tiver queda.`,
          metrics: { current: top1Pct, target: 30, entityName: sorted[0].nome },
          recommendations: [{
            action: "Diversificar investimento entre mais SKUs",
            impact: "medium",
            effort: "medium",
          }],
          source: "pattern",
          financialImpact: quantifyConcentrationRisk(sorted[0].revenue, totalRev),
        });
      }
    }
  }

  return findings;
}
