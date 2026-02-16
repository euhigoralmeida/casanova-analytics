import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { quantifyPaidDependency, ZERO_IMPACT } from "../cognitive/financial-impact";

/**
 * Analisa composição e mix de canais, tráfego orgânico vs pago.
 */
export function analyzeComposition(ctx: AnalysisContext, _cube?: DataCube): CognitiveFinding[] {
  const { channels, ga4, account } = ctx;
  const findings: CognitiveFinding[] = [];

  if (channels.length === 0 || !ga4) return findings;

  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  if (totalSessions === 0) return findings;

  const paidChannels = ["Cross-network", "Paid Search", "Paid Social", "Paid Shopping", "Paid Other", "Display"];
  const paidSessions = channels
    .filter((c) => paidChannels.includes(c.channel))
    .reduce((s, c) => s + c.sessions, 0);
  const organicSessions = channels
    .filter((c) => c.channel === "Organic Search" || c.channel === "Organic Social")
    .reduce((s, c) => s + c.sessions, 0);
  const directSessions = channels
    .filter((c) => c.channel === "Direct")
    .reduce((s, c) => s + c.sessions, 0);

  const paidPct = (paidSessions / totalSessions) * 100;
  const organicPct = (organicSessions / totalSessions) * 100;
  const directPct = (directSessions / totalSessions) * 100;

  // 1. Dependência alta de paid
  if (paidPct > 70) {
    const avgCPS = account && account.clicks > 0 ? account.ads / account.clicks : 1;
    const fi = quantifyPaidDependency(paidPct, totalSessions, avgCPS);

    findings.push({
      id: "comp-paid-heavy",
      category: "composition",
      severity: "warning",
      title: `${paidPct.toFixed(0)}% do tráfego é pago — dependência alta`,
      description: `Orgânico representa apenas ${organicPct.toFixed(0)}% das sessões. Investir em SEO pode reduzir custo de aquisição a longo prazo.`,
      metrics: { current: paidPct, target: 50 },
      recommendations: [{
        action: "Investir em SEO e conteúdo para aumentar tráfego orgânico",
        impact: "high",
        effort: "high",
        steps: ["Otimizar páginas de produto para SEO", "Criar blog com conteúdo relacionado", "Melhorar velocidade do site"],
      }],
      source: "pattern",
      financialImpact: fi,
    });
  }

  // 2. Base orgânica forte
  if (organicPct > 40 && paidPct < 30) {
    findings.push({
      id: "comp-organic-strong",
      category: "composition",
      severity: "success",
      title: `Base orgânica forte — ${organicPct.toFixed(0)}% do tráfego`,
      description: `Excelente base orgânica. Considere aumentar investimento em ads para capturar demanda incremental.`,
      metrics: { current: organicPct },
      recommendations: [],
      source: "pattern",
      financialImpact: { ...ZERO_IMPACT, confidence: 0.7, calculation: "Tráfego orgânico forte — custo de aquisição baixo" },
    });
  }

  // 3. Tráfego direto alto
  if (directPct > 25) {
    findings.push({
      id: "comp-direct-strong",
      category: "composition",
      severity: "success",
      title: `${directPct.toFixed(0)}% de tráfego direto — reconhecimento de marca`,
      description: `Indica boa lembrança de marca. Esse tráfego tem custo zero de aquisição.`,
      metrics: { current: directPct },
      recommendations: [],
      source: "pattern",
      financialImpact: { ...ZERO_IMPACT, confidence: 0.7, calculation: "Tráfego direto = custo zero de aquisição" },
    });
  }

  // 4. Canal com melhor conversão
  const channelsWithConv = channels.filter((c) => c.sessions > 50 && c.conversions > 0);
  if (channelsWithConv.length > 1 && account) {
    const best = channelsWithConv.sort((a, b) => (b.conversions / b.sessions) - (a.conversions / a.sessions))[0];
    const bestRate = (best.conversions / best.sessions) * 100;
    const avgRate = ga4.purchases / ga4.sessions * 100;

    if (bestRate > avgRate * 1.5) {
      // Impacto: se direcionasse 20% mais budget para esse canal
      const additionalSessions = totalSessions * 0.1;
      const additionalConversions = additionalSessions * (bestRate / 100);
      const aov = ga4.purchaseRevenue > 0 && ga4.purchases > 0 ? ga4.purchaseRevenue / ga4.purchases : 500;
      const potentialGain = additionalConversions * aov;

      findings.push({
        id: "comp-best-channel",
        category: "composition",
        severity: "success",
        title: `Canal "${best.channel}" converte ${bestRate.toFixed(2)}% — ${(bestRate / avgRate).toFixed(1)}x a média`,
        description: `Taxa de conversão de ${bestRate.toFixed(2)}% vs média geral de ${avgRate.toFixed(2)}%. Considere direcionar mais budget para este canal.`,
        metrics: { current: bestRate, target: avgRate, entityName: best.channel },
        recommendations: [{
          action: `Aumentar investimento no canal "${best.channel}"`,
          impact: "high",
          effort: "low",
        }],
        source: "pattern",
        financialImpact: {
          estimatedRevenueGain: Math.round(potentialGain * 100) / 100,
          estimatedCostSaving: 0,
          netImpact: Math.round(potentialGain * 100) / 100,
          confidence: 0.4,
          timeframe: "short",
          calculation: `+10% sessões no "${best.channel}" × ${bestRate.toFixed(2)}% conv = +${Math.round(additionalConversions)} pedidos`,
        },
      });
    }
  }

  return findings;
}
