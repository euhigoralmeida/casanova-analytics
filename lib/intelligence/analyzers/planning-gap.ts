import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import { quantifyRevenueGap, ZERO_IMPACT } from "../cognitive/financial-impact";

/**
 * Compara métricas atuais vs Planejamento 2026 (planType=target).
 * Gera CognitiveFindings com impacto financeiro quantificado.
 */
export function analyzePlanningGap(ctx: AnalysisContext, _cube?: DataCube): CognitiveFinding[] {
  const { planning, account, ga4, dayOfMonth, daysInMonth } = ctx;
  const findings: CognitiveFinding[] = [];

  if (!account && !ga4) return findings;

  const paceRatio = dayOfMonth / daysInMonth;
  const remaining = daysInMonth - dayOfMonth;

  // 1. Receita Captada gap
  if (planning.receita_captada && account) {
    const target = planning.receita_captada;
    const actual = account.revenue;
    const prorated = target * paceRatio;
    const gap = prorated > 0 ? ((actual - prorated) / prorated) * 100 : 0;

    if (Math.abs(gap) > 10) {
      const dailyNeeded = remaining > 0 ? (target - actual) / remaining : 0;
      const fi = quantifyRevenueGap(actual, target, dayOfMonth, daysInMonth);

      const approvalNote = planning.pct_aprovacao_receita
        ? ` (com ${(planning.pct_aprovacao_receita * 100).toFixed(0)}% de aprovação → meta faturada: ${formatBRL(planning.receita_faturada ?? 0)})`
        : "";

      findings.push({
        id: "pg-revenue-captada",
        category: "planning_gap",
        severity: gap < -20 ? "danger" : gap < 0 ? "warning" : "success",
        title: gap < 0
          ? `Receita Captada ${Math.abs(gap).toFixed(0)}% abaixo do ritmo planejado`
          : `Receita Captada ${gap.toFixed(0)}% acima do ritmo planejado`,
        description: gap < 0
          ? `Atual ${formatBRL(actual)} vs ritmo esperado ${formatBRL(prorated)} (meta mensal: ${formatBRL(target)})${approvalNote}. Faltam ${formatBRL(target - actual)} até o fim do mês.`
          : `Atual ${formatBRL(actual)} vs ritmo esperado ${formatBRL(prorated)}. No caminho para superar a meta de ${formatBRL(target)}${approvalNote}.`,
        metrics: { current: actual, target, gap, trendPct: gap },
        recommendations: gap < 0 ? [{
          action: `Aumentar captação em ${formatBRL(dailyNeeded)}/dia para atingir meta`,
          impact: "high",
          effort: "medium",
        }] : [],
        source: "planning",
        financialImpact: fi,
      });
    }
  }

  // 2. ROAS gap
  if (planning.roas_captado && account && account.ads > 0) {
    const targetRoas = planning.roas_captado;
    const actualRoas = account.roas;
    const gap = targetRoas > 0 ? ((actualRoas - targetRoas) / targetRoas) * 100 : 0;

    if (Math.abs(gap) > 15) {
      // Impacto: se ROAS subisse para meta, quanto a mais de receita?
      const revenueIfTarget = account.ads * targetRoas;
      const revenueGain = Math.max(revenueIfTarget - account.revenue, 0);

      findings.push({
        id: "pg-roas",
        category: "planning_gap",
        severity: gap < -20 ? "danger" : gap < 0 ? "warning" : "success",
        title: gap < 0
          ? `ROAS ${Math.abs(gap).toFixed(0)}% abaixo da meta`
          : `ROAS ${gap.toFixed(0)}% acima da meta`,
        description: `ROAS atual: ${actualRoas.toFixed(1)} vs meta: ${targetRoas.toFixed(1)}.`,
        metrics: { current: actualRoas, target: targetRoas, gap },
        recommendations: gap < -20 ? [{
          action: "Revisar campanhas com ROAS abaixo de 5",
          impact: "high",
          effort: "low",
          steps: ["Identificar campanhas com ROAS < 5", "Pausar as com gasto > R$ 500 e sem conversões"],
        }] : [],
        source: "planning",
        financialImpact: {
          estimatedRevenueGain: Math.round(revenueGain * 100) / 100,
          estimatedCostSaving: 0,
          netImpact: Math.round(revenueGain * 100) / 100,
          confidence: 0.5,
          timeframe: "short",
          calculation: `Se ROAS subir de ${actualRoas.toFixed(1)} para ${targetRoas.toFixed(1)}: +${formatBRL(revenueGain)}`,
        },
      });
    }
  }

  // 3. Budget pacing
  if (planning.investimento_ads && account) {
    const budgetTarget = planning.investimento_ads;
    const actualSpend = account.ads;
    const expectedSpend = budgetTarget * paceRatio;
    const paceGap = expectedSpend > 0 ? ((actualSpend - expectedSpend) / expectedSpend) * 100 : 0;

    if (Math.abs(paceGap) > 20) {
      const overSpend = Math.max(actualSpend - expectedSpend, 0);
      const underSpend = Math.max(expectedSpend - actualSpend, 0);

      findings.push({
        id: "pg-budget",
        category: "planning_gap",
        severity: paceGap > 40 ? "danger" : paceGap > 20 ? "warning" : "success",
        title: paceGap > 0
          ? `Investimento ${paceGap.toFixed(0)}% acima do ritmo planejado`
          : `Investimento ${Math.abs(paceGap).toFixed(0)}% abaixo do ritmo planejado`,
        description: `Gasto atual ${formatBRL(actualSpend)} vs esperado ${formatBRL(expectedSpend)} para dia ${dayOfMonth}. Orçamento mensal: ${formatBRL(budgetTarget)}.`,
        metrics: { current: actualSpend, target: budgetTarget, gap: paceGap },
        recommendations: paceGap > 20 ? [{
          action: "Ajustar orçamentos diários para não ultrapassar meta mensal",
          impact: "medium",
          effort: "low",
        }] : [{
          action: "Investimento abaixo do planejado pode limitar captação. Avaliar redistribuição.",
          impact: "medium",
          effort: "low",
        }],
        source: "planning",
        financialImpact: paceGap > 0
          ? { estimatedRevenueGain: 0, estimatedCostSaving: Math.round(overSpend * 100) / 100, netImpact: Math.round(overSpend * 100) / 100, confidence: 0.7, timeframe: "immediate", calculation: `Overspend de ${formatBRL(overSpend)} no período` }
          : { estimatedRevenueGain: Math.round(underSpend * account.roas * 100) / 100, estimatedCostSaving: 0, netImpact: Math.round(underSpend * account.roas * 100) / 100, confidence: 0.5, timeframe: "short", calculation: `Investir +${formatBRL(underSpend)} × ROAS ${account.roas.toFixed(1)} = +${formatBRL(underSpend * account.roas)}` },
      });
    }
  }

  // 4. Conversion rate gap
  if (planning.taxa_conversao_captado && ga4 && ga4.sessions > 0) {
    const targetConv = planning.taxa_conversao_captado;
    const actualConv = ga4.purchases / ga4.sessions;
    const gap = targetConv > 0 ? ((actualConv - targetConv) / targetConv) * 100 : 0;

    if (gap < -15) {
      const aov = ga4.purchaseRevenue > 0 && ga4.purchases > 0 ? ga4.purchaseRevenue / ga4.purchases : 500;
      const additionalOrders = ga4.sessions * (targetConv - actualConv);
      const revenueGain = additionalOrders * aov;

      findings.push({
        id: "pg-conversion",
        category: "planning_gap",
        severity: gap < -25 ? "danger" : "warning",
        title: `Taxa de conversão ${Math.abs(gap).toFixed(0)}% abaixo do planejado`,
        description: `Conversão atual: ${(actualConv * 100).toFixed(2)}% vs planejado: ${(targetConv * 100).toFixed(2)}%.`,
        metrics: { current: actualConv, target: targetConv, gap },
        recommendations: [{
          action: "Investigar gargalos no funil de conversão",
          impact: "high",
          effort: "medium",
          steps: ["Verificar taxa de abandono de carrinho", "Analisar página de checkout", "Revisar preços vs concorrência"],
        }],
        source: "planning",
        financialImpact: {
          estimatedRevenueGain: Math.round(revenueGain * 100) / 100,
          estimatedCostSaving: 0,
          netImpact: Math.round(revenueGain * 100) / 100,
          confidence: 0.4,
          timeframe: "medium",
          calculation: `+${additionalOrders.toFixed(0)} pedidos × ${formatBRL(aov)} = ${formatBRL(revenueGain)}`,
        },
      });
    }
  }

  // 5. Ticket Médio gap
  if (planning.ticket_medio_captado && account && account.conversions > 0) {
    const targetTicket = planning.ticket_medio_captado;
    const actualTicket = account.revenue / account.conversions;
    const gap = targetTicket > 0 ? ((actualTicket - targetTicket) / targetTicket) * 100 : 0;

    if (Math.abs(gap) > 15) {
      const revenueGain = gap < 0 ? (targetTicket - actualTicket) * account.conversions : 0;

      findings.push({
        id: "pg-ticket",
        category: "planning_gap",
        severity: gap < -20 ? "danger" : gap < 0 ? "warning" : "success",
        title: gap < 0
          ? `Ticket médio ${Math.abs(gap).toFixed(0)}% abaixo do planejado`
          : `Ticket médio ${gap.toFixed(0)}% acima do planejado`,
        description: `Ticket atual: ${formatBRL(actualTicket)} vs planejado: ${formatBRL(targetTicket)}.`,
        metrics: { current: actualTicket, target: targetTicket, gap },
        recommendations: gap < 0 ? [{
          action: "Promover SKUs de maior valor ou kits para elevar ticket",
          impact: "medium",
          effort: "medium",
          steps: ["Analisar mix de produtos vendidos", "Criar bundles/kits", "Revisar estratégia de upsell"],
        }] : [],
        source: "planning",
        financialImpact: gap < 0
          ? { estimatedRevenueGain: Math.round(revenueGain * 100) / 100, estimatedCostSaving: 0, netImpact: Math.round(revenueGain * 100) / 100, confidence: 0.4, timeframe: "medium", calculation: `+${formatBRL(targetTicket - actualTicket)}/pedido × ${account.conversions} pedidos = ${formatBRL(revenueGain)}` }
          : { ...ZERO_IMPACT, confidence: 0.7, calculation: "Ticket acima do planejado — performance positiva" },
      });
    }
  }

  // 6. Sessões gap
  if (planning.sessoes_totais && ga4) {
    const targetSessions = planning.sessoes_totais;
    const actualSessions = ga4.sessions;
    const prorated = targetSessions * paceRatio;
    const gap = prorated > 0 ? ((actualSessions - prorated) / prorated) * 100 : 0;

    if (Math.abs(gap) > 15) {
      // Impacto: sessões faltantes × conv rate × AOV
      const convRate = ga4.purchases > 0 && ga4.sessions > 0 ? ga4.purchases / ga4.sessions : 0.02;
      const aov = ga4.purchaseRevenue > 0 && ga4.purchases > 0 ? ga4.purchaseRevenue / ga4.purchases : 500;
      const missingToEndOfMonth = Math.max(targetSessions - actualSessions, 0);
      const revenueGain = missingToEndOfMonth * convRate * aov;

      findings.push({
        id: "pg-sessions",
        category: "planning_gap",
        severity: gap < -20 ? "danger" : gap < 0 ? "warning" : "success",
        title: gap < 0
          ? `Sessões ${Math.abs(gap).toFixed(0)}% abaixo do ritmo planejado`
          : `Sessões ${gap.toFixed(0)}% acima do ritmo planejado`,
        description: `Sessões atuais: ${actualSessions.toLocaleString("pt-BR")} vs esperado: ${Math.round(prorated).toLocaleString("pt-BR")} (meta mensal: ${Math.round(targetSessions).toLocaleString("pt-BR")}).`,
        metrics: { current: actualSessions, target: targetSessions, gap },
        recommendations: gap < 0 ? [{
          action: "Aumentar investimento em mídia ou melhorar CTR para gerar mais sessões",
          impact: "high",
          effort: "medium",
        }] : [],
        source: "planning",
        financialImpact: gap < 0
          ? { estimatedRevenueGain: Math.round(revenueGain * 100) / 100, estimatedCostSaving: 0, netImpact: Math.round(revenueGain * 100) / 100, confidence: 0.35, timeframe: "medium", calculation: `${missingToEndOfMonth.toLocaleString("pt-BR")} sessões × ${(convRate * 100).toFixed(2)}% conv × ${formatBRL(aov)} = ${formatBRL(revenueGain)}` }
          : { ...ZERO_IMPACT, confidence: 0.7, calculation: "Sessões acima do ritmo planejado" },
      });
    }
  }

  // 7. CPA gap
  if (planning.cpa_geral && account && account.conversions > 0) {
    const targetCpa = planning.cpa_geral;
    const actualCpa = account.cpa;
    const gap = targetCpa > 0 ? ((actualCpa - targetCpa) / targetCpa) * 100 : 0;

    if (gap > 20) {
      // Impacto: economia se CPA caísse para meta
      const saving = (actualCpa - targetCpa) * account.conversions;

      findings.push({
        id: "pg-cpa",
        category: "planning_gap",
        severity: gap > 40 ? "danger" : "warning",
        title: `CPA ${gap.toFixed(0)}% acima do planejado`,
        description: `CPA atual: ${formatBRL(actualCpa)} vs planejado: ${formatBRL(targetCpa)}.`,
        metrics: { current: actualCpa, target: targetCpa, gap },
        recommendations: [{
          action: `Reduzir CPA de ${formatBRL(actualCpa)} para ${formatBRL(targetCpa)}`,
          impact: "high",
          effort: "medium",
          steps: ["Pausar campanhas com CPA > R$ 100", "Otimizar lances em campanhas médias", "Melhorar qualidade dos anúncios"],
        }],
        source: "planning",
        financialImpact: {
          estimatedRevenueGain: 0,
          estimatedCostSaving: Math.round(saving * 100) / 100,
          netImpact: Math.round(saving * 100) / 100,
          confidence: 0.5,
          timeframe: "short",
          calculation: `(${formatBRL(actualCpa)} - ${formatBRL(targetCpa)}) × ${account.conversions} conversões = ${formatBRL(saving)} economia`,
        },
      });
    }
  }

  return findings;
}
