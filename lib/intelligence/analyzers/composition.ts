import type { AnalysisContext, IntelligenceInsight } from "../types";

/**
 * Analisa composição e mix de canais, tráfego orgânico vs pago.
 */
export function analyzeComposition(ctx: AnalysisContext): IntelligenceInsight[] {
  const { channels, ga4, account } = ctx;
  const insights: IntelligenceInsight[] = [];

  if (channels.length === 0 || !ga4) return insights;

  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  if (totalSessions === 0) return insights;

  // 1. Mix orgânico vs pago
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

  if (paidPct > 70) {
    insights.push({
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
    });
  }

  if (organicPct > 40 && paidPct < 30) {
    insights.push({
      id: "comp-organic-strong",
      category: "composition",
      severity: "success",
      title: `Base orgânica forte — ${organicPct.toFixed(0)}% do tráfego`,
      description: `Excelente base orgânica. Considere aumentar investimento em ads para capturar demanda incremental sem depender exclusivamente.`,
      metrics: { current: organicPct },
      recommendations: [],
      source: "pattern",
    });
  }

  // 2. Tráfego direto alto = marca forte
  const directPct = (directSessions / totalSessions) * 100;
  if (directPct > 25) {
    insights.push({
      id: "comp-direct-strong",
      category: "composition",
      severity: "success",
      title: `${directPct.toFixed(0)}% de tráfego direto — reconhecimento de marca`,
      description: `Indica boa lembrança de marca. Esse tráfego tem custo zero de aquisição.`,
      metrics: { current: directPct },
      recommendations: [],
      source: "pattern",
    });
  }

  // 3. Canal com melhor conversão
  const channelsWithConv = channels.filter((c) => c.sessions > 50 && c.conversions > 0);
  if (channelsWithConv.length > 1) {
    const best = channelsWithConv.sort((a, b) => (b.conversions / b.sessions) - (a.conversions / a.sessions))[0];
    const bestRate = (best.conversions / best.sessions) * 100;
    const avgRate = ga4.purchases / ga4.sessions * 100;

    if (bestRate > avgRate * 1.5 && account) {
      insights.push({
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
      });
    }
  }

  return insights;
}
