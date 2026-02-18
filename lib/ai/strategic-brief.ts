// Builds a comprehensive cross-domain brief for the Strategic Advisor LLM prompt
// Uses ONLY existing data sources — zero new queries

import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import {
  fetchEcommerceFunnel,
  fetchGA4Summary,
  fetchRetentionSummary,
  fetchUserLifetimeValue,
  fetchChannelAcquisition,
} from "@/lib/ga4-queries";
import { fetchCognitiveDirectly } from "./fetch-cognitive";
import { buildContextSummary, buildPeriodContext } from "./context-builder";
import { prisma } from "@/lib/db";
import { computeTargetMonth } from "@/lib/planning-target-calc";
import { formatBRL } from "@/lib/format";
import { isClarityConfigured, fetchClarityInsights } from "@/lib/clarity";

export async function buildStrategicBrief(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const sections: string[] = [];

  // Period context
  sections.push(buildPeriodContext(startDate, endDate));
  sections.push("");

  // Parallel fetches: cognitive + GA4 + planning + action history + clarity
  const [cognitive, ga4Extras, planningSection, actionsSection, clarityData] = await Promise.all([
    fetchCognitiveDirectly(tenantId, startDate, endDate).catch(() => null),
    fetchGA4Extras(startDate, endDate),
    fetchPlanningTargets(tenantId),
    fetchRecentActions(tenantId),
    isClarityConfigured() ? fetchClarityInsights(3).catch(() => null) : Promise.resolve(null),
  ]);

  // 1. AQUISICAO — from cognitive engine
  if (cognitive) {
    sections.push("## AQUISICAO (Google Ads)");
    sections.push(buildContextSummary(cognitive));
    sections.push("");
  }

  // 2. CRO — funnel data
  if (ga4Extras.funnel) {
    sections.push("## CRO (Funil de Conversao)");
    for (const step of ga4Extras.funnel) {
      const dropLabel = step.dropoff > 0 ? ` | Abandono: ${step.dropoff}%` : "";
      sections.push(`- ${step.step}: ${step.count.toLocaleString("pt-BR")} (taxa: ${step.rate}%${dropLabel})`);
    }
    if (ga4Extras.overallConversionRate !== undefined) {
      sections.push(`Taxa conversao geral (page_view→purchase): ${ga4Extras.overallConversionRate}%`);
    }
    sections.push("");
  }

  if (ga4Extras.summary) {
    sections.push("## CRO (Metricas de Site)");
    const s = ga4Extras.summary;
    sections.push(`Sessoes: ${s.sessions.toLocaleString("pt-BR")} | Engajadas: ${s.engagedSessions.toLocaleString("pt-BR")}`);
    sections.push(`Bounce rate: ${s.bounceRate}% | Usuarios: ${s.users.toLocaleString("pt-BR")} (${s.newUsers.toLocaleString("pt-BR")} novos)`);
    sections.push(`Compras: ${s.purchases} | Receita GA4: ${formatBRL(s.purchaseRevenue)}`);
    sections.push(`Ticket medio: ${formatBRL(s.avgOrderValue)}`);
    sections.push(`Abandono carrinho: ${s.cartAbandonmentRate}% | Abandono checkout: ${s.checkoutAbandonmentRate}%`);
    sections.push("");
  }

  // 2.5 CRO (Comportamento — Clarity)
  if (clarityData && clarityData.source === "clarity") {
    sections.push("## CRO (Comportamento - Clarity)");
    const b = clarityData.behavioral;
    sections.push(`Dead clicks: ${b.deadClicks.toLocaleString("pt-BR")} | Rage clicks: ${b.rageClicks.toLocaleString("pt-BR")}`);
    sections.push(`Scroll depth medio: ${b.avgScrollDepth.toFixed(0)}% | Tempo engajamento: ${Math.floor(b.avgEngagementTime / 60)}m${Math.round(b.avgEngagementTime % 60)}s`);
    sections.push(`Quickbacks: ${b.quickbackClicks} | Erros JS: ${b.scriptErrors} | Error clicks: ${b.errorClicks}`);
    sections.push(`Trafego total: ${b.totalTraffic.toLocaleString("pt-BR")} sessoes | Paginas/sessao: ${b.pagesPerSession}`);
    const worstPages = clarityData.pageAnalysis.slice(0, 3);
    if (worstPages.length > 0) {
      sections.push("Piores paginas (UX Score):");
      for (const p of worstPages) {
        sections.push(`- ${p.pageTitle} (${p.url}): Score ${p.uxScore}/100, ${p.rageClicks} rage clicks, ${p.deadClicks} dead clicks`);
      }
    }
    sections.push("");
  }

  // 3. RETENCAO & LTV
  if (ga4Extras.retention) {
    sections.push("## RETENCAO & LTV");
    const r = ga4Extras.retention;
    sections.push(`Usuarios totais: ${r.totalUsers.toLocaleString("pt-BR")} | Novos: ${r.newUsers.toLocaleString("pt-BR")} | Retornaram: ${r.returningUsers.toLocaleString("pt-BR")}`);
    sections.push(`Taxa retorno: ${r.returnRate}%`);
    sections.push(`Sessoes/usuario: ${r.avgSessionsPerUser}`);
    sections.push(`Compradores: ${r.purchasers.toLocaleString("pt-BR")} | Compras: ${r.purchases}`);
    sections.push(`Receita: ${formatBRL(r.revenue)} | Ticket medio: ${formatBRL(r.avgOrderValue)}`);
    const ltv = r.purchasers > 0 ? Math.round((r.revenue / r.purchasers) * 100) / 100 : 0;
    sections.push(`LTV por comprador: ${formatBRL(ltv)}`);
    sections.push(`Estimativa recompra: ${r.repurchaseEstimate}`);
    sections.push("");
  }

  // 4. LTV por canal
  if (ga4Extras.channelLTV && ga4Extras.channelLTV.length > 0) {
    sections.push("## LTV POR CANAL");
    for (const c of ga4Extras.channelLTV.slice(0, 8)) {
      sections.push(`- ${c.channel}: ${c.users} usuarios, ${formatBRL(c.revenue)} receita, LTV ${formatBRL(c.revenuePerPurchaser)}, ticket ${formatBRL(c.avgTicket)}`);
    }
    sections.push("");
  }

  // 5. CANAIS de aquisicao
  if (ga4Extras.channels && ga4Extras.channels.length > 0) {
    sections.push("## CANAIS DE AQUISICAO");
    const totalUsers = ga4Extras.channels.reduce((sum, c) => sum + c.users, 0);
    for (const c of ga4Extras.channels.slice(0, 8)) {
      const pct = totalUsers > 0 ? Math.round((c.users / totalUsers) * 100) : 0;
      sections.push(`- ${c.channel}: ${pct}% dos usuarios (${c.users}), ${c.conversions} conversoes, ${formatBRL(c.revenue)} receita`);
    }
    sections.push("");
  }

  // 6. METAS vs REAL
  if (planningSection) {
    sections.push(planningSection);
    sections.push("");
  }

  // 7. DECISOES RECENTES
  if (actionsSection) {
    sections.push(actionsSection);
    sections.push("");
  }

  return sections.join("\n");
}

// ---------- Helpers ----------

async function fetchGA4Extras(startDate: string, endDate: string) {
  if (!isGA4Configured()) {
    return {};
  }

  const client = getGA4Client();
  const [funnelData, summary, retention, channelLTV, channels] = await Promise.all([
    fetchEcommerceFunnel(client, startDate, endDate).catch(() => null),
    fetchGA4Summary(client, startDate, endDate).catch(() => null),
    fetchRetentionSummary(client, startDate, endDate).catch(() => null),
    fetchUserLifetimeValue(client, startDate, endDate).catch(() => null),
    fetchChannelAcquisition(client, startDate, endDate).catch(() => null),
  ]);

  return {
    funnel: funnelData?.funnel,
    overallConversionRate: funnelData?.overallConversionRate,
    summary,
    retention,
    channelLTV,
    channels,
  };
}

async function fetchPlanningTargets(tenantId: string): Promise<string | null> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const planRows = await prisma.planningEntry.findMany({
      where: { tenantId, year, month, planType: "target" },
    });
    if (planRows.length === 0) return null;

    const inputs: Record<string, number> = {};
    for (const row of planRows) inputs[row.metric] = row.value;
    const calc = computeTargetMonth(inputs);
    const all = { ...inputs, ...calc };

    const lines: string[] = ["## METAS vs PLANEJAMENTO (mes corrente)"];
    const add = (label: string, key: string, fmt: "brl" | "num" | "pct") => {
      const v = all[key];
      if (v == null) return;
      const formatted = fmt === "brl" ? formatBRL(v) : fmt === "pct" ? `${(v * 100).toFixed(1)}%` : Math.round(v).toLocaleString("pt-BR");
      lines.push(`- ${label}: ${formatted}`);
    };

    add("Receita Captada Meta", "receita_captada", "brl");
    add("Receita Faturada Meta", "receita_faturada", "brl");
    add("Investimento Total", "investimento_total", "brl");
    add("ROAS Captado Meta", "roas_captado", "num");
    add("Pedidos Captados Meta", "pedidos_captados", "num");
    add("Ticket Medio Meta", "ticket_medio_real", "brl");
    add("Taxa Conversao Meta", "taxa_conversao_real", "pct");
    add("% Retencao Meta", "pct_retencao", "pct");

    return lines.length > 1 ? lines.join("\n") : null;
  } catch {
    return null;
  }
}

async function fetchRecentActions(tenantId: string): Promise<string | null> {
  try {
    const actions = await prisma.actionLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (actions.length === 0) return null;

    const lines: string[] = ["## DECISOES RECENTES (ultimas acoes)"];
    for (const a of actions.slice(0, 5)) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const type = a.actionType === "followed" ? "SEGUIU" : a.actionType === "dismissed" ? "DESCARTOU" : "ANOTOU";
      lines.push(`- [${date}] ${type}: ${a.description}`);
    }
    return lines.join("\n");
  } catch {
    return null;
  }
}
