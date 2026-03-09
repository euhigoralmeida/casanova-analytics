// Builds a comprehensive cross-domain brief for the Strategic Advisor LLM prompt
// Uses ONLY existing data sources — zero new queries

import { getGA4ClientAsync } from "@/lib/google-analytics";
import {
  fetchEcommerceFunnel,
  fetchGA4Summary,
  fetchChannelAcquisition,
} from "@/lib/ga4-queries";
import { fetchCognitiveDirectly } from "./fetch-cognitive";
import { buildContextSummary, buildPeriodContext } from "./context-builder";
import { prisma } from "@/lib/db";
import { computeTargetMonth } from "@/lib/planning-target-calc";
import { formatBRL } from "@/lib/format";
import { getClarityFromDB } from "@/lib/clarity";
import { fetchKeywordMetrics, fetchPageMetrics } from "@/lib/gsc-queries";
import { getCustomerAsync } from "@/lib/google-ads";
import { fetchSearchTerms } from "@/lib/queries";
import { detectCannibalization } from "@/lib/organic-cannibalization";

export async function buildStrategicBrief(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const sections: string[] = [];

  // Period context
  sections.push(buildPeriodContext(startDate, endDate));
  sections.push("");

  // Parallel fetches: cognitive + GA4 + planning + action history + clarity + organic
  const [cognitive, ga4Extras, planningSection, actionsSection, clarityData, organicSection] = await Promise.all([
    fetchCognitiveDirectly(tenantId, startDate, endDate).catch(() => null),
    fetchGA4Extras(tenantId, startDate, endDate),
    fetchPlanningTargets(tenantId),
    fetchRecentActions(tenantId),
    getClarityFromDB(tenantId, 3).then(s => s?.data ?? null).catch(() => null),
    fetchOrganicSection(tenantId, startDate, endDate),
  ]);

  // 1. AQUISICAO — from cognitive engine
  if (cognitive) {
    sections.push("## AQUISICAO (Google Ads)");
    sections.push(buildContextSummary(cognitive));
    sections.push("");
  }

  // 1.5 AQUISICAO (Meta Ads)
  const metaSection = await fetchMetaAdsSection(tenantId, startDate, endDate);
  if (metaSection) {
    sections.push(metaSection);
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
    if (b.botSessions > 0) {
      const botPct = b.totalTraffic > 0 ? Math.round((b.botSessions / b.totalTraffic) * 100) : 0;
      sections.push(`Bots: ${b.botSessions} sessoes (${botPct}%) | Usuarios distintos: ${b.distinctUsers.toLocaleString("pt-BR")}`);
    }
    if (b.activeTimeRatio > 0) {
      sections.push(`Responsividade (active/total time): ${Math.round(b.activeTimeRatio * 100)}%`);
    }
    const worstPages = clarityData.pageAnalysis.slice(0, 3);
    if (worstPages.length > 0) {
      sections.push("Piores paginas (Impact Score):");
      for (const p of worstPages) {
        sections.push(`- ${p.pageTitle} (${p.url}): UX ${p.uxScore}/100, Impact ${p.impactScore}, dead ${p.deadClickRate}%/sess, rage ${p.rageClickRate}%/sess, ${p.traffic} sessoes`);
      }
    }
    sections.push("");

    // Channel UX quality
    if (clarityData.channelBreakdown.length > 0) {
      sections.push("## CRO (Qualidade UX por Canal - Clarity)");
      for (const ch of clarityData.channelBreakdown.slice(0, 6)) {
        sections.push(`- ${ch.channel}: ${ch.traffic} sess, dead ${ch.deadClickRate}%, rage ${ch.rageClickRate}%, scroll ${ch.scrollDepth.toFixed(0)}%, erros JS: ${ch.scriptErrors}`);
      }
      sections.push("");
    }

    // Campaign UX quality
    if (clarityData.campaignBreakdown.length > 0) {
      sections.push("## CRO (Qualidade UX por Campanha - Clarity)");
      for (const camp of clarityData.campaignBreakdown.slice(0, 5)) {
        sections.push(`- ${camp.campaign}: ${camp.traffic} sess, dead ${camp.deadClickRate}%, rage ${camp.rageClickRate}%, erros JS: ${camp.scriptErrors}`);
      }
      sections.push("");
    }

    // Technical diagnostics (OS + Browser)
    const techWithErrors = clarityData.techBreakdown.filter(t => t.scriptErrors > 0);
    if (techWithErrors.length > 0) {
      sections.push("## DIAGNOSTICO TECNICO (Erros JS por OS/Browser - Clarity)");
      const totalErrors = techWithErrors.reduce((s, t) => s + t.scriptErrors, 0);
      for (const t of techWithErrors.slice(0, 8)) {
        const pct = totalErrors > 0 ? Math.round((t.scriptErrors / totalErrors) * 100) : 0;
        sections.push(`- ${t.name} (${t.type}): ${t.scriptErrors} erros (${pct}% do total), taxa ${t.scriptErrorRate}%/sess, ${t.traffic} sessoes`);
      }
      sections.push("");
    }
  }

  // 3. RETENCAO & LTV (CRM — pedidos reais)
  const crmSection = await fetchCRMSection(tenantId, startDate, endDate);
  if (crmSection) {
    sections.push(crmSection);
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

  // 5.5 ORGANICO (SEO)
  if (organicSection) {
    sections.push(organicSection);
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

async function fetchGA4Extras(tenantId: string, startDate: string, endDate: string) {
  const client = await getGA4ClientAsync(tenantId);
  if (!client) return {};

  const [funnelData, summary, channels] = await Promise.all([
    fetchEcommerceFunnel(client, startDate, endDate, tenantId).catch(() => null),
    fetchGA4Summary(client, startDate, endDate, tenantId).catch(() => null),
    fetchChannelAcquisition(client, startDate, endDate, tenantId).catch(() => null),
  ]);

  return {
    funnel: funnelData?.funnel,
    overallConversionRate: funnelData?.overallConversionRate,
    summary,
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

async function fetchMetaAdsSection(tenantId: string, startDate: string, endDate: string): Promise<string | null> {
  try {
    const { fetchMetaCampaigns, fetchMetaAccountTotals, getMetaCredentials } = await import("@/lib/meta-ads");
    const metaCreds = await getMetaCredentials(tenantId);
    if (!metaCreds) return null;

    const [campaigns, totals] = await Promise.all([
      fetchMetaCampaigns(startDate, endDate, tenantId),
      fetchMetaAccountTotals(startDate, endDate, tenantId),
    ]);

    const lines: string[] = ["## AQUISICAO (Meta Ads)"];
    lines.push(`Investimento: ${formatBRL(totals.spend)} | Receita: ${formatBRL(totals.revenue)} | ROAS: ${totals.roas} | CPA: ${formatBRL(totals.cpa)}`);
    lines.push(`Impressoes: ${totals.impressions.toLocaleString("pt-BR")} | Cliques: ${totals.clicks.toLocaleString("pt-BR")} | Conversoes: ${totals.conversions}`);
    lines.push(`CTR: ${totals.ctr}% | CPC: ${formatBRL(totals.cpc)}`);

    const topCampaigns = campaigns.sort((a, b) => b.spend - a.spend).slice(0, 5);
    if (topCampaigns.length > 0) {
      lines.push("Top campanhas por investimento:");
      for (const c of topCampaigns) {
        lines.push(`- ${c.campaignName} (${c.status}): ${formatBRL(c.spend)} invest, ROAS ${c.roas}, ${c.conversions} conv, ${formatBRL(c.revenue)} receita`);
      }
    }

    return lines.join("\n");
  } catch (err) {
    console.error("Error fetching Meta Ads for brief:", err);
    return null;
  }
}

async function fetchOrganicSection(tenantId: string, startDate: string, endDate: string): Promise<string | null> {
  try {
    const [keywords, pages] = await Promise.all([
      fetchKeywordMetrics(startDate, endDate, tenantId).catch(() => []),
      fetchPageMetrics(startDate, endDate, tenantId).catch(() => []),
    ]);

    if (keywords.length === 0 && pages.length === 0) return null;

    const totalClicks = keywords.reduce((s, k) => s + k.clicks, 0);
    const totalImpressions = keywords.reduce((s, k) => s + k.impressions, 0);
    const avgPosition = keywords.length > 0
      ? keywords.reduce((s, k) => s + k.position * k.impressions, 0) / Math.max(1, totalImpressions)
      : 0;

    const lines: string[] = ["## ORGANICO (SEO)"];
    lines.push(`Total cliques organicos: ${totalClicks.toLocaleString("pt-BR")} | Impressoes: ${totalImpressions.toLocaleString("pt-BR")} | Posicao media: ${avgPosition.toFixed(1)}`);

    // Top keywords
    const topKw = [...keywords].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
    if (topKw.length > 0) {
      lines.push("Top keywords por cliques:");
      for (const k of topKw) {
        lines.push(`- "${k.query}": pos ${k.position.toFixed(1)}, ${k.clicks} cliques, ${k.impressions} impressoes, CTR ${(k.ctr * 100).toFixed(1)}%`);
      }
    }

    // Top pages
    const topPages = [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    if (topPages.length > 0) {
      lines.push("Top paginas organicas:");
      for (const p of topPages) {
        let path = p.page;
        try { path = new URL(p.page).pathname; } catch { /* ignore */ }
        lines.push(`- ${path}: pos ${p.position.toFixed(1)}, ${p.clicks} cliques, ${p.impressions} impressoes`);
      }
    }

    // Cannibalization summary
    const customer = await getCustomerAsync(tenantId);
    if (customer) {
      try {
        const adsTerms = await fetchSearchTerms(customer, startDate, endDate, tenantId);
        const cannibal = detectCannibalization(keywords, adsTerms);
        if (cannibal.length > 0) {
          const totalSavings = cannibal.reduce((s, c) => s + c.estimatedSavingsBRL, 0);
          const fullCount = cannibal.filter((c) => c.type === "full_cannibal").length;
          lines.push(`Canibalizacao SEO x Ads: ${cannibal.length} overlaps detectados (${fullCount} canibalizacao total), economia potencial: ${formatBRL(totalSavings)}`);
          for (const c of cannibal.slice(0, 3)) {
            lines.push(`- "${c.keyword}": pos org ${c.organicPosition.toFixed(0)}, custo pago ${formatBRL(c.paidCostBRL)}, tipo ${c.type}, economia ${formatBRL(c.estimatedSavingsBRL)}`);
          }
        }
      } catch { /* ignore ads errors */ }
    }

    return lines.join("\n");
  } catch (err) {
    console.error("Error fetching organic section for brief:", err);
    return null;
  }
}

async function fetchCRMSection(tenantId: string, startDate: string, endDate: string): Promise<string | null> {
  try {
    const { getMagazordCredentials } = await import("@/lib/magazord");
    const { fetchOrders } = await import("@/lib/magazord-queries");
    const { computeCRMAnalytics } = await import("@/lib/crm-engine");
    const creds = await getMagazordCredentials(tenantId);
    if (!creds) return null;
    const orders = await fetchOrders(startDate, endDate, tenantId);
    if (orders.length === 0) return null;
    const analytics = computeCRMAnalytics(orders);
    const s = analytics.summary;

    const lines: string[] = ["## RETENCAO & LTV (CRM — pedidos reais)"];
    lines.push(`Total clientes: ${s.totalCustomers.toLocaleString("pt-BR")} | Total pedidos: ${s.totalOrders.toLocaleString("pt-BR")}`);
    lines.push(`Receita: ${formatBRL(s.totalRevenue)} | Ticket medio: ${formatBRL(s.avgTicket)}`);
    lines.push(`Taxa recompra (2+ pedidos): ${s.repurchaseRate.toFixed(1)}%`);
    lines.push(`LTV medio: ${formatBRL(s.avgLTV)} | Churn 90d: ${s.churn90d.toFixed(1)}%`);

    // RFM distribution
    if (analytics.rfmDistribution.length > 0) {
      lines.push("Distribuicao RFM:");
      for (const r of analytics.rfmDistribution) {
        lines.push(`- ${r.segment}: ${r.count} clientes, ${formatBRL(r.revenue)} receita, ticket ${formatBRL(r.avgTicket)}`);
      }
    }

    return lines.join("\n");
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
