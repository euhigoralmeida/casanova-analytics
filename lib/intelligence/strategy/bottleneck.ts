/* =========================
   Bottleneck Detector
   Decompõe Receita = Tráfego × Conversão × Ticket Médio
   e identifica qual constraint tem maior impacto marginal.
========================= */

import type { Bottleneck } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";

/**
 * Detecta o principal gargalo do negócio decompondo a receita.
 *
 * Receita = Sessões × Taxa_Conversão × Ticket_Médio
 *
 * Para cada componente, simulamos +10% e medimos quanto da meta seria recuperado.
 * O componente com maior impacto marginal é o gargalo.
 */
export function detectBottleneck(cube: DataCube): Bottleneck {
  const { account, ga4, planning, meta } = cube;

  // Defaults se dados insuficientes
  const defaultBottleneck: Bottleneck = {
    constraint: "traffic",
    severity: 0.5,
    explanation: "Dados insuficientes para análise de gargalo",
    financialImpact: {
      estimatedRevenueGain: 0,
      estimatedCostSaving: 0,
      netImpact: 0,
      confidence: 0.2,
      timeframe: "medium",
      calculation: "N/A",
    },
    unlockAction: "Coletar mais dados",
  };

  if (!account || !ga4 || ga4.sessions === 0) return defaultBottleneck;

  const sessions = ga4.sessions;
  const convRate = ga4.conversionRate;
  const aov = ga4.avgOrderValue || (account.revenue / Math.max(account.conversions, 1));
  const currentRevenue = account.revenue;

  // Se temos meta, usamos como base; senão, usamos +20% como referência
  const revenueTarget = planning.receita_captada
    ? planning.receita_captada * (meta.dayOfMonth / meta.daysInMonth)
    : currentRevenue * 1.2;

  const revenueGap = Math.max(revenueTarget - currentRevenue, 0);

  // Simular +10% em cada componente
  const simulations: {
    constraint: Bottleneck["constraint"];
    label: string;
    impact: number;
    unlockAction: string;
  }[] = [
    {
      constraint: "traffic",
      label: "Sessões",
      impact: sessions * 0.1 * convRate * aov,
      unlockAction: "Aumentar investimento em mídia ou melhorar CTR para gerar mais tráfego",
    },
    {
      constraint: "conversion",
      label: "Taxa de Conversão",
      impact: sessions * convRate * 0.1 * aov,
      unlockAction: "Otimizar funil de conversão: landing pages, checkout, UX",
    },
    {
      constraint: "aov",
      label: "Ticket Médio",
      impact: sessions * convRate * aov * 0.1,
      unlockAction: "Promover upsell, cross-sell e kits para elevar ticket",
    },
  ];

  // Margem como constraint adicional
  if (account.ads > 0) {
    const margin = ((currentRevenue - account.ads) / currentRevenue) * 100;
    if (margin < 25) {
      simulations.push({
        constraint: "margin",
        label: "Margem",
        impact: currentRevenue * 0.05, // 5% improvement in margin
        unlockAction: "Reduzir CPA pausando campanhas ineficientes ou negociando custos",
      });
    }
  }

  // Budget como constraint
  if (planning.investimento_ads && account.ads > 0) {
    const paceRatio = meta.dayOfMonth / meta.daysInMonth;
    const expectedSpend = planning.investimento_ads * paceRatio;
    if (account.ads < expectedSpend * 0.8) {
      simulations.push({
        constraint: "budget",
        label: "Orçamento",
        impact: (expectedSpend - account.ads) * account.roas,
        unlockAction: "Investir o orçamento planejado — budget abaixo do ritmo",
      });
    }
  }

  // Encontrar constraint com maior impacto marginal
  simulations.sort((a, b) => b.impact - a.impact);
  const primary = simulations[0];

  // Severity = gap como % da meta
  const severity = revenueTarget > 0
    ? Math.min(revenueGap / revenueTarget, 1)
    : 0.5;

  return {
    constraint: primary.constraint,
    severity,
    explanation: `Gargalo principal: ${primary.label}. Melhoria de 10% neste componente geraria +${formatBRL(primary.impact)} em receita.`,
    financialImpact: {
      estimatedRevenueGain: Math.round(primary.impact * 100) / 100,
      estimatedCostSaving: 0,
      netImpact: Math.round(primary.impact * 100) / 100,
      confidence: 0.6,
      timeframe: "short",
      calculation: `+10% ${primary.label} = +${formatBRL(primary.impact)} receita`,
    },
    unlockAction: primary.unlockAction,
  };
}
