// Executes AI tool calls using existing data functions
// TenantId is injected server-side — LLM cannot access other tenants' data

import { isConfigured, getCustomer } from "@/lib/google-ads";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import {
  fetchAccountTotals,
  fetchAllSkuMetrics,
  fetchSkuMetrics,
  fetchAllCampaignMetrics,
  fetchDeviceMetrics,
  fetchDemographicMetrics,
  fetchGeographicMetrics,
  fetchAccountTimeSeries,
  fetchSkuTimeSeries,
} from "@/lib/queries";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchChannelAcquisition, fetchRetentionSummary, fetchUserLifetimeValue, fetchCohortRetention } from "@/lib/ga4-queries";
import { prisma } from "@/lib/db";
import { computeTargetMonth } from "@/lib/planning-target-calc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolInput = Record<string, any>;

export async function executeTool(
  toolName: string,
  input: ToolInput,
  tenantId: string,
): Promise<string> {
  try {
    const result = await executeToolInternal(toolName, input, tenantId);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

async function executeToolInternal(
  toolName: string,
  input: ToolInput,
  _tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { startDate, endDate } = input;
  const period = "custom";

  switch (toolName) {
    case "get_account_metrics": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      const data = await fetchAccountTotals(customer, period, startDate, endDate);
      const revenue = Math.round(data.revenue * 100) / 100;
      const ads = Math.round(data.costBRL * 100) / 100;
      return {
        receita: revenue,
        investimento: ads,
        roas: ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0,
        cpa: data.conversions > 0 ? Math.round((ads / data.conversions) * 100) / 100 : 0,
        impressoes: data.impressions,
        cliques: data.clicks,
        conversoes: data.conversions,
        ctr: data.impressions > 0 ? Math.round((data.clicks / data.impressions) * 10000) / 100 : 0,
      };
    }

    case "get_sku_metrics": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      if (input.sku) {
        const data = await fetchSkuMetrics(customer, input.sku, period, startDate, endDate);
        if (!data) return { error: `SKU ${input.sku} não encontrado` };
        return formatSku(data);
      }
      const allData = await fetchAllSkuMetrics(customer, period, startDate, endDate);
      return allData.map(formatSku);
    }

    case "get_campaign_metrics": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      const data = await fetchAllCampaignMetrics(customer, period, startDate, endDate);
      return data.map((c) => ({
        campanha: c.campaignName,
        tipo: c.channelType,
        status: c.status,
        receita: Math.round(c.revenue * 100) / 100,
        investimento: Math.round(c.costBRL * 100) / 100,
        roas: c.costBRL > 0 ? Math.round((c.revenue / c.costBRL) * 100) / 100 : 0,
        cpa: c.conversions > 0 ? Math.round((c.costBRL / c.conversions) * 100) / 100 : 0,
        conversoes: c.conversions,
        impressoes: c.impressions,
        cliques: c.clicks,
      }));
    }

    case "get_segmentation": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      const segment = input.segment as string;

      if (segment === "device") {
        const data = await fetchDeviceMetrics(customer, period, startDate, endDate);
        return data.map(formatSegment);
      }
      if (segment === "age" || segment === "gender") {
        const data = await fetchDemographicMetrics(customer, period, startDate, endDate);
        return data.filter((d) => d.type === segment).map(formatDemoSegment);
      }
      if (segment === "geographic") {
        const data = await fetchGeographicMetrics(customer, period, startDate, endDate);
        return data.map(formatGeoSegment);
      }
      return { error: `Segmento desconhecido: ${segment}` };
    }

    case "get_ga4_funnel": {
      if (!isGA4Configured()) return { error: "GA4 não configurado" };
      const client = getGA4Client();
      const [funnelData, summary] = await Promise.all([
        fetchEcommerceFunnel(client, startDate, endDate),
        fetchGA4Summary(client, startDate, endDate),
      ]);
      return {
        funil: funnelData.funnel,
        taxaConversaoGeral: funnelData.overallConversionRate,
        sessoes: summary.sessions,
        usuarios: summary.users,
        compras: summary.purchases,
        receitaGA4: summary.purchaseRevenue,
        taxaRejeicao: summary.bounceRate,
        abandonoCarrinho: summary.cartAbandonmentRate,
      };
    }

    case "get_channel_acquisition": {
      if (!isGA4Configured()) return { error: "GA4 não configurado" };
      const client = getGA4Client();
      const data = await fetchChannelAcquisition(client, startDate, endDate);
      return data.map((c) => ({
        canal: c.channel,
        sessoes: c.sessions,
        usuarios: c.users,
        conversoes: c.conversions,
        receita: c.revenue,
      }));
    }

    case "get_planning_targets": {
      const { year, month } = input;
      const planRows = await prisma.planningEntry.findMany({
        where: { tenantId: _tenantId, year, month, planType: "target" },
      });
      if (planRows.length === 0) return { error: `Sem metas para ${month}/${year}` };
      const inputs: Record<string, number> = {};
      for (const row of planRows) {
        inputs[row.metric] = row.value;
      }
      const calc = computeTargetMonth(inputs);
      return { ...inputs, ...calc };
    }

    case "get_timeseries": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      if (input.scope === "sku" && input.id) {
        const data = await fetchSkuTimeSeries(customer, input.id, period, startDate, endDate);
        return data.map(formatDaily);
      }
      const data = await fetchAccountTimeSeries(customer, period, startDate, endDate);
      return data.map(formatDaily);
    }

    case "get_cognitive_analysis": {
      // Reuse the intelligence endpoint internally
      const { analyzeCognitive } = await import("@/lib/intelligence/cognitive-engine");
      const { loadSkuExtras } = await import("@/lib/sku-master");

      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const sd = new Date(startDate);
      const ed = new Date(endDate);
      const daysInPeriod = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;

      // Fetch all data needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let account: any, skus: any[] = [], campaigns: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let devices: any[] = [], demographics: any[] = [], geographic: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ga4: any = undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let channels: any[] = [];

      if (isConfigured()) {
        const customer = getCustomer();
        const skuExtras = await loadSkuExtras(_tenantId);
        const [acctData, allSkuData, campData, devData, demoData, geoData] = await Promise.all([
          fetchAccountTotals(customer, period, startDate, endDate),
          fetchAllSkuMetrics(customer, period, startDate, endDate),
          fetchAllCampaignMetrics(customer, period, startDate, endDate),
          fetchDeviceMetrics(customer, period, startDate, endDate).catch(() => []),
          fetchDemographicMetrics(customer, period, startDate, endDate).catch(() => []),
          fetchGeographicMetrics(customer, period, startDate, endDate).catch(() => []),
        ]);

        const revenue = Math.round(acctData.revenue * 100) / 100;
        const ads = Math.round(acctData.costBRL * 100) / 100;
        account = {
          ads, impressions: acctData.impressions, clicks: acctData.clicks,
          conversions: acctData.conversions, revenue,
          roas: ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0,
          cpa: acctData.conversions > 0 ? Math.round((ads / acctData.conversions) * 100) / 100 : 0,
          ctr: acctData.impressions > 0 ? Math.round((acctData.clicks / acctData.impressions) * 10000) / 100 : 0,
        };

        skus = allSkuData.map((d) => {
          const extras = skuExtras[d.sku];
          const rev = Math.round(d.revenue * 100) / 100;
          const cost = Math.round(d.costBRL * 100) / 100;
          const roas = cost > 0 ? Math.round((rev / cost) * 100) / 100 : 0;
          const cpa = d.conversions > 0 ? Math.round((cost / d.conversions) * 100) / 100 : 0;
          return {
            sku: d.sku, nome: extras?.nome ?? d.title,
            revenue: rev, ads: cost, roas, cpa,
            impressions: d.impressions, clicks: d.clicks, conversions: d.conversions,
            status: "manter" as const,
          };
        });

        campaigns = campData.map((c) => ({
          campaignId: c.campaignId, campaignName: c.campaignName,
          channelType: c.channelType, status: c.status,
          costBRL: c.costBRL, revenue: c.revenue,
          roas: c.costBRL > 0 ? Math.round((c.revenue / c.costBRL) * 100) / 100 : 0,
          cpa: c.conversions > 0 ? Math.round((c.costBRL / c.conversions) * 100) / 100 : 0,
          conversions: c.conversions, impressions: c.impressions, clicks: c.clicks,
        }));

        devices = devData;
        demographics = demoData;
        geographic = geoData;
      }

      if (isGA4Configured()) {
        const ga4Client = getGA4Client();
        const [summary, channelData] = await Promise.all([
          fetchGA4Summary(ga4Client, startDate, endDate),
          fetchChannelAcquisition(ga4Client, startDate, endDate),
        ]);
        ga4 = {
          sessions: summary.sessions, users: summary.users,
          purchases: summary.purchases, purchaseRevenue: summary.purchaseRevenue,
          bounceRate: summary.bounceRate, engagedSessions: summary.engagedSessions,
          cartAbandonmentRate: summary.cartAbandonmentRate,
        };
        channels = channelData.map((c) => ({
          channel: c.channel, sessions: c.sessions,
          users: c.users, conversions: c.conversions, revenue: c.revenue,
        }));
      }

      // Planning
      let planning = {};
      try {
        const planRows = await prisma.planningEntry.findMany({
          where: { tenantId: _tenantId, year: now.getFullYear(), month: now.getMonth() + 1, planType: "target" },
        });
        const inputs: Record<string, number> = {};
        for (const row of planRows) inputs[row.metric] = row.value;
        const calc = computeTargetMonth(inputs);
        planning = { ...inputs, ...calc };
      } catch { /* ignore */ }

      const result = await analyzeCognitive({
        tenantId: _tenantId,
        periodStart: startDate,
        periodEnd: endDate,
        daysInPeriod,
        dayOfMonth,
        daysInMonth,
        account,
        skus,
        campaigns,
        ga4,
        channels,
        planning,
        devices,
        demographics,
        geographic,
      });

      return {
        modo: result.mode,
        gargalo: result.bottleneck,
        healthScore: result.healthScore,
        findings: result.findings.slice(0, 10).map((rd) => ({
          titulo: rd.finding.title,
          descricao: rd.finding.description,
          severidade: rd.finding.severity,
          impactoR$: rd.components.impactBRL,
          acao: rd.finding.recommendations?.[0]?.action,
        })),
        pacing: result.pacingProjections,
        resumo: result.executiveSummary,
      };
    }

    case "get_retention_metrics": {
      if (!isGA4Configured()) return { error: "GA4 não configurado" };
      const ga4Client = getGA4Client();
      const [summary, ltv, cohorts] = await Promise.all([
        fetchRetentionSummary(ga4Client, startDate, endDate),
        fetchUserLifetimeValue(ga4Client, startDate, endDate),
        fetchCohortRetention(ga4Client, startDate, endDate),
      ]);
      return {
        resumo: {
          usuariosTotal: summary.totalUsers,
          novos: summary.newUsers,
          retornantes: summary.returningUsers,
          taxaRetorno: summary.returnRate,
          sessoesPorUsuario: summary.avgSessionsPerUser,
          compras: summary.purchases,
          compradores: summary.purchasers,
          receita: summary.revenue,
          ticketMedio: summary.avgOrderValue,
          ltvPorComprador: summary.purchasers > 0 ? Math.round((summary.revenue / summary.purchasers) * 100) / 100 : 0,
          frequenciaRecompra: summary.repurchaseEstimate,
        },
        topCanaisLTV: ltv.slice(0, 5).map((c) => ({
          canal: c.channel,
          usuarios: c.users,
          compradores: c.purchasers,
          receita: c.revenue,
          receitaPorComprador: c.revenuePerPurchaser,
          comprasPorUsuario: c.purchasesPerUser,
        })),
        cohorts: cohorts.slice(0, 6).map((c) => ({
          semana: c.cohortWeek,
          usuariosIniciais: c.usersStart,
          retencao: c.retention.slice(0, 5),
        })),
      };
    }

    case "get_cro_clarity": {
      const { isClarityConfigured, fetchClarityInsights } = await import("@/lib/clarity");
      if (!isClarityConfigured()) return { error: "Microsoft Clarity não configurado" };
      const clarityData = await fetchClarityInsights(3);
      if (clarityData.source !== "clarity") return { error: "Erro ao buscar dados do Clarity" };
      const b = clarityData.behavioral;
      const top5Pages = clarityData.pageAnalysis.slice(0, 5).map((p) => ({
        pagina: p.pageTitle,
        url: p.url,
        uxScore: p.uxScore,
        impactScore: p.impactScore,
        deadClicks: p.deadClicks,
        deadClickRate: p.deadClickRate,
        rageClicks: p.rageClicks,
        rageClickRate: p.rageClickRate,
        scrollDepth: p.scrollDepth,
        trafego: p.traffic,
        quickbacks: p.quickbacks,
      }));
      const worstDevice = clarityData.deviceBreakdown.reduce((worst, d) =>
        d.rageClicks > worst.rageClicks ? d : worst, clarityData.deviceBreakdown[0]);
      return {
        metricas: {
          deadClicks: b.deadClicks,
          rageClicks: b.rageClicks,
          scrollDepthMedio: b.avgScrollDepth,
          tempoEngajamentoMedio: b.avgEngagementTime,
          quickbacks: b.quickbackClicks,
          errosJS: b.scriptErrors,
          errorClicks: b.errorClicks,
          trafego: b.totalTraffic,
          paginasPorSessao: b.pagesPerSession,
          botSessions: b.botSessions,
          distinctUsers: b.distinctUsers,
          activeTimeRatio: b.activeTimeRatio,
        },
        pioresPaginas: top5Pages,
        dispositivoMaisProblematico: {
          dispositivo: worstDevice.device,
          rageClicks: worstDevice.rageClicks,
          deadClicks: worstDevice.deadClicks,
          scrollDepth: worstDevice.scrollDepth,
          trafego: worstDevice.traffic,
          errosJS: worstDevice.scriptErrors,
          quickbacks: worstDevice.quickbacks,
          engajamento: worstDevice.engagementTime,
        },
        canais: clarityData.channelBreakdown.slice(0, 6).map((c) => ({
          canal: c.channel,
          trafego: c.traffic,
          deadClickRate: c.deadClickRate,
          rageClickRate: c.rageClickRate,
          scrollDepth: c.scrollDepth,
          errosJS: c.scriptErrors,
          quickbacks: c.quickbacks,
        })),
        campanhas: clarityData.campaignBreakdown.slice(0, 5).map((c) => ({
          campanha: c.campaign,
          trafego: c.traffic,
          deadClickRate: c.deadClickRate,
          rageClickRate: c.rageClickRate,
          errosJS: c.scriptErrors,
        })),
        diagnosticoTecnico: clarityData.techBreakdown.filter((t) => t.scriptErrors > 0).slice(0, 6).map((t) => ({
          nome: t.name,
          tipo: t.type,
          trafego: t.traffic,
          errosJS: t.scriptErrors,
          taxaErro: t.scriptErrorRate,
        })),
      };
    }

    case "compare_periods": {
      if (!isConfigured()) return { error: "Google Ads não configurado" };
      const customer = getCustomer();
      const [p1, p2] = await Promise.all([
        fetchAccountTotals(customer, "custom", input.period1Start, input.period1End),
        fetchAccountTotals(customer, "custom", input.period2Start, input.period2End),
      ]);

      const format = (d: typeof p1) => {
        const rev = Math.round(d.revenue * 100) / 100;
        const ads = Math.round(d.costBRL * 100) / 100;
        return {
          receita: rev, investimento: ads,
          roas: ads > 0 ? Math.round((rev / ads) * 100) / 100 : 0,
          cpa: d.conversions > 0 ? Math.round((ads / d.conversions) * 100) / 100 : 0,
          impressoes: d.impressions, cliques: d.clicks, conversoes: d.conversions,
        };
      };
      const f1 = format(p1);
      const f2 = format(p2);

      const pctChange = (a: number, b: number) => b !== 0 ? Math.round(((a - b) / b) * 10000) / 100 : 0;

      return {
        periodo1: { inicio: input.period1Start, fim: input.period1End, ...f1 },
        periodo2: { inicio: input.period2Start, fim: input.period2End, ...f2 },
        variacao: {
          receita: pctChange(f1.receita, f2.receita),
          investimento: pctChange(f1.investimento, f2.investimento),
          roas: pctChange(f1.roas, f2.roas),
          cpa: pctChange(f1.cpa, f2.cpa),
          conversoes: pctChange(f1.conversoes, f2.conversoes),
        },
      };
    }

    default:
      return { error: `Tool desconhecida: ${toolName}` };
  }
}

// --- Helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSku(d: any) {
  const revenue = Math.round(d.revenue * 100) / 100;
  const ads = Math.round(d.costBRL * 100) / 100;
  return {
    sku: d.sku,
    titulo: d.title,
    receita: revenue,
    investimento: ads,
    roas: ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0,
    cpa: d.conversions > 0 ? Math.round((ads / d.conversions) * 100) / 100 : 0,
    impressoes: d.impressions,
    cliques: d.clicks,
    conversoes: d.conversions,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSegment(d: any) {
  return {
    dispositivo: d.device,
    receita: Math.round(d.revenue * 100) / 100,
    investimento: Math.round(d.costBRL * 100) / 100,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    conversoes: d.conversions,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDemoSegment(d: any) {
  return {
    segmento: d.segment,
    tipo: d.type,
    receita: Math.round(d.revenue * 100) / 100,
    investimento: Math.round(d.costBRL * 100) / 100,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    conversoes: d.conversions,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGeoSegment(d: any) {
  return {
    regiao: d.region,
    receita: Math.round(d.revenue * 100) / 100,
    investimento: Math.round(d.costBRL * 100) / 100,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    conversoes: d.conversions,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDaily(d: any) {
  return {
    data: d.date,
    receita: Math.round(d.revenue * 100) / 100,
    investimento: Math.round(d.costBRL * 100) / 100,
    impressoes: d.impressions,
    cliques: d.clicks,
    conversoes: d.conversions,
  };
}
