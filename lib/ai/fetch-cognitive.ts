// Fetches cognitive analysis directly (no HTTP round-trip)
// Used by /api/chat and /api/ai-insights to avoid server-to-server fetch issues on Vercel

import { isConfigured, getCustomer } from "@/lib/google-ads";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchAccountTotals, fetchAllSkuMetrics, fetchAllCampaignMetrics, fetchDeviceMetrics, fetchDemographicMetrics, fetchGeographicMetrics } from "@/lib/queries";
import { fetchGA4Summary, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { prisma } from "@/lib/db";
import { computeTargetMonth } from "@/lib/planning-target-calc";
import { analyzeCognitive } from "@/lib/intelligence/cognitive-engine";
import { loadSkuExtras } from "@/lib/sku-master";
import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMetrics = any;

function deriveStatus(roas: number, cpa: number, _marginPct: number, stock: number, conversions: number): "escalar" | "manter" | "pausar" {
  if (conversions === 0 && roas === 0) return "pausar";
  if (roas < 5 || cpa > 80) return "pausar";
  if (roas < 7) return "manter";
  if (stock > 20) return "escalar";
  return "manter";
}

export async function fetchCognitiveDirectly(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<CognitiveResponse | null> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const dayOfMonth = now.getDate();
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const sd = new Date(startDate);
    const ed = new Date(endDate);
    const periodDays = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;

    // Planning
    let planning: AnyMetrics = {};
    try {
      const planRows = await prisma.planningEntry.findMany({
        where: { tenantId, year: currentYear, month: currentMonth, planType: "target" },
      });
      const inputs: Record<string, number> = {};
      for (const row of planRows) inputs[row.metric] = row.value;
      const calc = computeTargetMonth(inputs);
      const targetAll = { ...inputs, ...calc };
      planning = {
        receita_captada: targetAll.receita_captada,
        receita_faturada: targetAll.receita_faturada,
        receita_cancelada: targetAll.receita_cancelada,
        investimento_ads: targetAll.investimento_total,
        google_ads: targetAll.invest_midia_paga,
        roas_captado: targetAll.roas_captado,
        roas_pago: targetAll.roas_faturado,
        taxa_conversao_captado: targetAll.taxa_conversao_real,
        cpa_geral: targetAll.cpa_real,
        sessoes_totais: targetAll.sessoes,
        pedido_captado: targetAll.pedidos_captados,
        ticket_medio_captado: targetAll.ticket_medio_real,
        pct_aprovacao_receita: targetAll.pct_aprovacao_receita,
      };
    } catch (err) {
      console.error("fetchCognitiveDirectly: planning error:", err);
    }

    // SKU extras
    const skuExtras = await loadSkuExtras(tenantId);

    // Google Ads
    let account: AnyMetrics | undefined;
    let skus: AnyMetrics[] = [];
    let campaigns: AnyMetrics[] = [];
    let devices: AnyMetrics[] = [];
    let demographics: AnyMetrics[] = [];
    let geographic: AnyMetrics[] = [];

    if (isConfigured()) {
      try {
        const customer = getCustomer();
        const period = "custom";
        const [acctData, allSkuData, campData, deviceData, demoData, geoData] = await Promise.all([
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
          const marginPct = extras?.marginPct ?? 30;
          const stock = extras?.stock ?? 0;
          return {
            sku: d.sku, nome: extras?.nome ?? d.title,
            revenue: rev, ads: cost, roas, cpa,
            impressions: d.impressions, clicks: d.clicks, conversions: d.conversions,
            status: deriveStatus(roas, cpa, marginPct, stock, d.conversions),
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

        devices = deviceData;
        demographics = demoData;
        geographic = geoData;
      } catch (err) {
        console.error("fetchCognitiveDirectly: Google Ads error:", err);
      }
    }

    // GA4
    let ga4: AnyMetrics | undefined;
    let channels: AnyMetrics[] = [];

    if (isGA4Configured()) {
      try {
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
      } catch (err) {
        console.error("fetchCognitiveDirectly: GA4 error:", err);
      }
    }

    const result = await analyzeCognitive({
      tenantId,
      periodStart: startDate,
      periodEnd: endDate,
      daysInPeriod: periodDays,
      dayOfMonth,
      daysInMonth: totalDaysInMonth,
      account, skus, campaigns, ga4, channels, planning,
      devices, demographics, geographic,
    });

    return result;
  } catch (err) {
    console.error("fetchCognitiveDirectly: error:", err);
    return null;
  }
}
