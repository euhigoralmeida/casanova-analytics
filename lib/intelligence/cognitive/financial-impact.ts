/* =========================
   Financial Impact Calculator
   Quantifica cada finding em R$ de impacto estimado.
========================= */

import type { FinancialImpact } from "./types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";

/** Impacto zero (placeholder seguro) */
export const ZERO_IMPACT: FinancialImpact = {
  estimatedRevenueGain: 0,
  estimatedCostSaving: 0,
  netImpact: 0,
  confidence: 0.3,
  timeframe: "medium",
  calculation: "Sem dados suficientes para estimar impacto",
};

function impact(
  gain: number,
  saving: number,
  confidence: number,
  timeframe: FinancialImpact["timeframe"],
  calculation: string,
): FinancialImpact {
  return {
    estimatedRevenueGain: Math.round(gain * 100) / 100,
    estimatedCostSaving: Math.round(saving * 100) / 100,
    netImpact: Math.round((gain + saving) * 100) / 100,
    confidence,
    timeframe,
    calculation,
  };
}

/**
 * Gap de receita vs planejamento.
 * Se estamos atrás do ritmo, o impacto é o gap projetado até fim do mês.
 */
export function quantifyRevenueGap(
  actual: number,
  target: number,
  dayOfMonth: number,
  daysInMonth: number,
): FinancialImpact {
  const remaining = daysInMonth - dayOfMonth;
  const dailyRate = dayOfMonth > 0 ? actual / dayOfMonth : 0;
  const projected = actual + dailyRate * remaining;
  const gap = target - projected;

  if (gap <= 0) {
    return impact(0, 0, 0.7, "medium", `Projeção ${formatBRL(projected)} supera meta de ${formatBRL(target)}`);
  }

  return impact(
    gap, 0, 0.6, "medium",
    `Gap projetado: ${formatBRL(target)} - ${formatBRL(projected)} = ${formatBRL(gap)} (${remaining} dias restantes)`,
  );
}

/**
 * Pausa de campanhas sem conversão.
 * Economia = gasto atual que seria evitado.
 */
export function quantifyWastedSpend(wastedAmount: number): FinancialImpact {
  return impact(
    0, wastedAmount, 0.9, "immediate",
    `Economia imediata de ${formatBRL(wastedAmount)} ao pausar campanhas sem conversão`,
  );
}

/**
 * Realocação de budget entre SKUs/campanhas.
 * Ganho = budget realocado × (ROAS destino - ROAS origem).
 */
export function quantifyBudgetReallocation(
  amount: number,
  fromRoas: number,
  toRoas: number,
): FinancialImpact {
  const currentRevenue = amount * fromRoas;
  const newRevenue = amount * toRoas;
  const gain = newRevenue - currentRevenue;
  // Aplicar desconto de 40% — ROAS pode cair ao aumentar spend
  const adjustedGain = gain * 0.6;

  return impact(
    adjustedGain, 0, 0.5, "short",
    `${formatBRL(amount)} × (ROAS ${toRoas.toFixed(1)} - ${fromRoas.toFixed(1)}) × 60% confiança = ${formatBRL(adjustedGain)}`,
  );
}

/**
 * SKUs subinvestidos com alto ROAS.
 * Ganho = aumento potencial de budget × ROAS × desconto.
 */
export function quantifyUnderinvestment(
  currentSpend: number,
  avgSpend: number,
  roas: number,
): FinancialImpact {
  const potentialIncrease = Math.min(avgSpend - currentSpend, currentSpend * 2);
  // Desconto de 50% — ROAS diminui com escala
  const gain = potentialIncrease * roas * 0.5;

  return impact(
    gain, 0, 0.4, "short",
    `+${formatBRL(potentialIncrease)} investimento × ROAS ${roas.toFixed(1)} × 50% desconto = ${formatBRL(gain)}`,
  );
}

/**
 * SKUs com status "pausar" — economia ao parar de investir.
 */
export function quantifyPauseSkus(wastedAds: number, avgRoas: number): FinancialImpact {
  // Perda de receita ao pausar (mas receita já é baixa = ROAS ruim)
  const lostRevenue = wastedAds * avgRoas;
  // Se ROAS < 5, o saving líquido = ads - (revenue perdida que era pouco rentável)
  const netSaving = wastedAds - lostRevenue;

  if (netSaving > 0) {
    return impact(0, netSaving, 0.7, "immediate", `Economia líquida: ${formatBRL(wastedAds)} gastos - ${formatBRL(lostRevenue)} receita perdida = ${formatBRL(netSaving)}`);
  }

  // Mesmo com perda, libera budget para realocar
  return impact(0, wastedAds, 0.5, "short", `${formatBRL(wastedAds)} liberados para realocação em SKUs rentáveis`);
}

/**
 * Melhoria de conversão.
 * Se taxa subir X%, quanto de receita adicional?
 */
export function quantifyConversionImprovement(
  cube: DataCube,
  currentRate: number,
  targetRate: number,
): FinancialImpact {
  if (!cube.ga4 || currentRate <= 0) return ZERO_IMPACT;

  const sessions = cube.ga4.sessions;
  const aov = cube.ga4.avgOrderValue || (cube.account?.revenue ?? 0) / Math.max(cube.account?.conversions ?? 1, 1);
  const additionalPurchases = sessions * (targetRate - currentRate);
  const gain = additionalPurchases * aov;

  // Prorated to monthly
  const { dayOfMonth, daysInMonth } = cube.meta;
  const monthlyGain = dayOfMonth > 0 ? (gain / dayOfMonth) * daysInMonth : gain;

  return impact(
    monthlyGain, 0, 0.4, "medium",
    `+${additionalPurchases.toFixed(0)} pedidos × ${formatBRL(aov)} ticket × projeção mensal = ${formatBRL(monthlyGain)}`,
  );
}

/**
 * Risco de concentração de receita.
 * Se o SKU top cair 30%, quanto se perde?
 */
export function quantifyConcentrationRisk(
  topSkuRevenue: number,
  totalRevenue: number,
): FinancialImpact {
  const atRisk = topSkuRevenue * 0.3; // cenário: queda de 30%

  return impact(
    0, 0, 0.5, "medium",
    `Se SKU principal cair 30%: -${formatBRL(atRisk)} (${((topSkuRevenue / totalRevenue) * 100).toFixed(0)}% da receita)`,
  );
}

/**
 * Dependência de tráfego pago.
 * Custo incremental vs se tivesse mais orgânico.
 */
export function quantifyPaidDependency(
  paidPct: number,
  totalSessions: number,
  avgCPS: number,
): FinancialImpact {
  // Se orgânico subisse para 50%, quantas sessões pagas economizamos?
  const idealPaidPct = 50;
  if (paidPct <= idealPaidPct) return ZERO_IMPACT;

  const excessPaidSessions = totalSessions * ((paidPct - idealPaidPct) / 100);
  const savingIfOrganic = excessPaidSessions * avgCPS;

  return impact(
    0, savingIfOrganic, 0.3, "medium",
    `${Math.round(excessPaidSessions)} sessões pagas em excesso × CPS ${formatBRL(avgCPS)} = ${formatBRL(savingIfOrganic)}/período`,
  );
}

/**
 * Bounce rate alto → perda de conversões.
 */
export function quantifyBounceImpact(cube: DataCube): FinancialImpact {
  if (!cube.ga4 || !cube.account) return ZERO_IMPACT;

  const { bounceRate, sessions } = cube.ga4;
  const targetBounce = 0.45;
  if (bounceRate <= targetBounce) return ZERO_IMPACT;

  // Sessões perdidas pelo bounce excessivo
  const excessBounce = bounceRate - targetBounce;
  const recoveredSessions = sessions * excessBounce;
  const convRate = cube.ga4.conversionRate;
  const aov = cube.ga4.avgOrderValue || cube.account.revenue / Math.max(cube.account.conversions, 1);
  const gain = recoveredSessions * convRate * aov;

  return impact(
    gain, 0, 0.35, "medium",
    `${Math.round(recoveredSessions)} sessões recuperáveis × ${(convRate * 100).toFixed(2)}% conv × ${formatBRL(aov)} = ${formatBRL(gain)}`,
  );
}

/**
 * Abandono de carrinho → receita perdida.
 */
export function quantifyCartAbandonmentImpact(cube: DataCube): FinancialImpact {
  if (!cube.ga4) return ZERO_IMPACT;

  const { cartAbandonmentRate, purchases, avgOrderValue } = cube.ga4;
  const targetAbandon = 70;
  if (cartAbandonmentRate <= targetAbandon) return ZERO_IMPACT;

  // Se reduzisse abandono para 70%, quantos pedidos a mais?
  const currentCompletionRate = (100 - cartAbandonmentRate) / 100;
  const targetCompletionRate = (100 - targetAbandon) / 100;
  // Carrinhos estimados = purchases / currentCompletionRate
  const estimatedCarts = currentCompletionRate > 0 ? purchases / currentCompletionRate : 0;
  const additionalPurchases = estimatedCarts * (targetCompletionRate - currentCompletionRate);
  const gain = additionalPurchases * (avgOrderValue || 500);

  return impact(
    gain, 0, 0.4, "medium",
    `Reduzir abandono de ${cartAbandonmentRate.toFixed(0)}% → 70%: +${additionalPurchases.toFixed(0)} pedidos × ${formatBRL(avgOrderValue || 500)} = ${formatBRL(gain)}`,
  );
}
