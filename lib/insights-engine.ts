import type { OverviewResponse, SmartAlertsResponse, GA4DataResponse } from "@/types/api";

export type Insight = {
  text: string;
  type: "positive" | "negative" | "neutral";
};

/**
 * Gera 3-5 frases de resumo executivo baseado nos dados atuais.
 * Rule-based, sem dependência de IA externa.
 */
export function generateInsights(
  overview: OverviewResponse | null,
  alerts: SmartAlertsResponse | null,
  ga4: GA4DataResponse | null,
): Insight[] {
  const insights: Insight[] = [];

  if (!overview) return insights;

  const totals = overview.accountTotals;
  const meta = overview.meta;

  // 1. Performance geral vs meta
  if (meta.revenueActual > 0 && meta.revenueTarget > 0) {
    const pct = Math.round((meta.revenueActual / meta.revenueTarget) * 100);
    if (pct >= 100) {
      insights.push({
        text: `Meta de faturamento atingida (${pct}%). Receita de R$ ${fmtK(meta.revenueActual)} vs meta de R$ ${fmtK(meta.revenueTarget)}.`,
        type: "positive",
      });
    } else if (pct >= 80) {
      insights.push({
        text: `Faturamento em ${pct}% da meta mensal (R$ ${fmtK(meta.revenueActual)} de R$ ${fmtK(meta.revenueTarget)}). Bom ritmo.`,
        type: "neutral",
      });
    } else {
      insights.push({
        text: `Faturamento em apenas ${pct}% da meta mensal. Pode ser necessário intensificar campanhas.`,
        type: "negative",
      });
    }
  }

  // 2. ROAS da conta
  if (totals && totals.ads > 0) {
    const roas = Math.round((totals.revenue / totals.ads) * 100) / 100;
    if (roas >= 7) {
      insights.push({
        text: `ROAS da conta em ${roas.toFixed(1)}x — acima da meta (7,0). Boa eficiência de investimento.`,
        type: "positive",
      });
    } else if (roas >= 5) {
      insights.push({
        text: `ROAS da conta em ${roas.toFixed(1)}x — abaixo da meta (7,0) mas acima do limite de pausa (5,0).`,
        type: "neutral",
      });
    } else {
      insights.push({
        text: `ROAS da conta em ${roas.toFixed(1)}x — abaixo do limite de pausa (5,0). Revisão urgente necessária.`,
        type: "negative",
      });
    }
  }

  // 3. Top e bottom performers
  if (overview.skus.length > 2) {
    const sorted = [...overview.skus].sort((a, b) => b.revenue - a.revenue);
    const top = sorted[0];
    const bottom = sorted.filter((s) => s.ads > 0).sort((a, b) => a.roas - b.roas)[0];

    if (top) {
      insights.push({
        text: `Maior faturamento: ${top.nome || top.sku} com R$ ${fmtK(top.revenue)} (ROAS ${top.roas > 0 ? top.roas.toFixed(1) : "—"}).`,
        type: "neutral",
      });
    }
    if (bottom && bottom.roas < 5 && bottom.roas > 0) {
      insights.push({
        text: `SKU com pior ROAS: ${bottom.nome || bottom.sku} (${bottom.roas.toFixed(1)}x). Considere pausar ou otimizar.`,
        type: "negative",
      });
    }
  }

  // 4. Alertas críticos
  if (alerts && alerts.summary.danger > 0) {
    insights.push({
      text: `${alerts.summary.danger} alerta${alerts.summary.danger > 1 ? "s" : ""} crítico${alerts.summary.danger > 1 ? "s" : ""} detectado${alerts.summary.danger > 1 ? "s" : ""}. Verifique a seção de alertas.`,
      type: "negative",
    });
  } else if (alerts && alerts.summary.total === 0) {
    insights.push({
      text: "Nenhum alerta detectado neste período. Performance estável.",
      type: "positive",
    });
  }

  // 5. Funil GA4
  if (ga4?.source === "ga4" && ga4.summary) {
    const { cartAbandonmentRate, checkoutAbandonmentRate } = ga4.summary;
    if (cartAbandonmentRate > 80) {
      insights.push({
        text: `Taxa de abandono de carrinho em ${cartAbandonmentRate.toFixed(0)}% — muito alta. Considere otimizar a experiência de checkout.`,
        type: "negative",
      });
    } else if (checkoutAbandonmentRate > 50) {
      insights.push({
        text: `Abandono no checkout em ${checkoutAbandonmentRate.toFixed(0)}%. Verifique etapas de pagamento e frete.`,
        type: "negative",
      });
    }
  }

  return insights.slice(0, 5);
}

function fmtK(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}
