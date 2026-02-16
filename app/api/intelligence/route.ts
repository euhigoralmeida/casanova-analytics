import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchAllSkuMetrics, fetchAccountTotals, fetchAllCampaignMetrics } from "@/lib/queries";
import { fetchGA4Summary, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { computeTargetMonth } from "@/lib/planning-target-calc";
import { analyzeCognitive } from "@/lib/intelligence/cognitive-engine";
import { loadSkuExtras } from "@/lib/sku-master";
import { persistDailySnapshot } from "@/lib/intelligence/snapshot";
import type { AnalysisContext, PlanningMetrics, AccountMetrics, SkuMetrics, CampaignMetrics, GA4Metrics, ChannelData } from "@/lib/intelligence/types";

function deriveStatus(roas: number, cpa: number, marginPct: number, stock: number, conversions: number): "escalar" | "manter" | "pausar" {
  if (conversions === 0 && roas === 0) return "pausar";
  if (roas < 5 || cpa > 80) return "pausar";
  if (roas < 7 || marginPct < 25) return "manter";
  if (stock > 20) return "escalar";
  return "manter";
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/* =========================
   GET /api/intelligence?period=30d&startDate=...&endDate=...
========================= */
export async function GET(req: NextRequest) {
  try {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "30d";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = daysInMonth(currentYear, currentMonth);

  // Parse period for daysInPeriod
  const periodDays = parseInt(period) || 30;

  // 1. Fetch planning TARGET data for current month (Planejamento 2026)
  let planning: PlanningMetrics = {};
  try {
    const planRows = await prisma.planningEntry.findMany({
      where: { tenantId: session.tenantId, year: currentYear, month: currentMonth, planType: "target" },
    });
    const inputs: Record<string, number> = {};
    for (const row of planRows) {
      inputs[row.metric] = row.value;
    }
    // Compute calculated metrics from target inputs (cascade)
    const calc = computeTargetMonth(inputs);
    const targetAll = { ...inputs, ...calc };

    // Map target metrics → PlanningMetrics format expected by analyzers
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
    console.error("Intelligence: planning fetch error:", err);
  }

  // 2. Load SKU extras from DB (margin, stock, cost)
  const skuExtras = await loadSkuExtras(session.tenantId);

  // 3. Fetch Google Ads data
  let account: AccountMetrics | undefined;
  let skus: SkuMetrics[] = [];
  let campaigns: CampaignMetrics[] = [];

  if (isConfigured()) {
    try {
      const customer = getCustomer();
      const [acctData, allSkuData, campData] = await Promise.all([
        fetchAccountTotals(customer, period, startDate, endDate),
        fetchAllSkuMetrics(customer, period, startDate, endDate),
        fetchAllCampaignMetrics(customer, period, startDate, endDate),
      ]);

      account = {
        ads: Math.round(acctData.costBRL * 100) / 100,
        impressions: acctData.impressions,
        clicks: acctData.clicks,
        conversions: acctData.conversions,
        revenue: Math.round(acctData.revenue * 100) / 100,
        roas: acctData.costBRL > 0 ? Math.round((acctData.revenue / acctData.costBRL) * 100) / 100 : 0,
        cpa: acctData.conversions > 0 ? Math.round((acctData.costBRL / acctData.conversions) * 100) / 100 : 0,
        ctr: acctData.impressions > 0 ? Math.round((acctData.clicks / acctData.impressions) * 10000) / 100 : 0,
      };

      skus = allSkuData.map((d) => {
        const extras = skuExtras[d.sku];
        const revenue = Math.round(d.revenue * 100) / 100;
        const ads = Math.round(d.costBRL * 100) / 100;
        const roas = ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0;
        const cpa = d.conversions > 0 ? Math.round((ads / d.conversions) * 100) / 100 : 0;
        const marginPct = extras?.marginPct ?? 30;
        const stock = extras?.stock ?? 0;
        return {
          sku: d.sku,
          nome: extras?.nome ?? d.title,
          revenue, ads, roas, cpa,
          impressions: d.impressions,
          clicks: d.clicks,
          conversions: d.conversions,
          status: deriveStatus(roas, cpa, marginPct, stock, d.conversions),
        };
      });

      campaigns = campData.map((c) => ({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        channelType: c.channelType,
        status: c.status,
        costBRL: c.costBRL,
        revenue: c.revenue,
        roas: c.costBRL > 0 ? Math.round((c.revenue / c.costBRL) * 100) / 100 : 0,
        cpa: c.conversions > 0 ? Math.round((c.costBRL / c.conversions) * 100) / 100 : 0,
        conversions: c.conversions,
        impressions: c.impressions,
        clicks: c.clicks,
      }));
    } catch (err) {
      console.error("Intelligence: Google Ads error:", err);
    }
  }

  // 4. Fetch GA4 data
  let ga4: GA4Metrics | undefined;
  let channels: ChannelData[] = [];

  if (isGA4Configured()) {
    try {
      const ga4Client = getGA4Client();
      const [summary, channelData] = await Promise.all([
        fetchGA4Summary(ga4Client, startDate ?? "", endDate ?? ""),
        fetchChannelAcquisition(ga4Client, startDate ?? "", endDate ?? ""),
      ]);

      ga4 = {
        sessions: summary.sessions,
        users: summary.users,
        purchases: summary.purchases,
        purchaseRevenue: summary.purchaseRevenue,
        bounceRate: summary.bounceRate,
        engagedSessions: summary.engagedSessions,
        cartAbandonmentRate: summary.cartAbandonmentRate,
      };

      channels = channelData.map((c) => ({
        channel: c.channel,
        sessions: c.sessions,
        users: c.users,
        conversions: c.conversions,
        revenue: c.revenue,
      }));
    } catch (err) {
      console.error("Intelligence: GA4 error:", err);
    }
  }

  // 5. Build context and run analysis
  const ctx: AnalysisContext = {
    tenantId: session.tenantId,
    periodStart: startDate ?? "",
    periodEnd: endDate ?? "",
    daysInPeriod: periodDays,
    dayOfMonth,
    daysInMonth: totalDaysInMonth,
    account,
    skus,
    campaigns,
    ga4,
    channels,
    planning,
  };

  let result;
  try {
    result = await analyzeCognitive(ctx);
  } catch (err) {
    console.error("Intelligence: analyze error:", err);
    return NextResponse.json({ error: "Erro ao analisar", detail: String(err) }, { status: 500 });
  }

  // 6. Persist insights (async, don't block response)
  if (result.insights.length > 0 && startDate && endDate) {
    prisma.insight.createMany({
      data: result.insights.map((i) => ({
        tenantId: session.tenantId,
        periodStart: startDate,
        periodEnd: endDate,
        category: i.category,
        severity: i.severity,
        title: i.title,
        description: i.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metrics: i.metrics as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recommendations: i.recommendations as any,
        source: i.source,
      })),
    }).catch((e: unknown) => console.error("Intelligence: insight persist error:", e));
  }

  // 7. Persist daily metric snapshot (async, don't block response)
  if (account) {
    const today = new Date().toISOString().slice(0, 10);
    persistDailySnapshot(
      session.tenantId,
      today,
      { revenue: account.revenue, ads: account.ads, roas: account.roas, cpa: account.cpa,
        impressions: account.impressions, clicks: account.clicks, conversions: account.conversions, ctr: account.ctr },
      skus.map((s) => ({
        sku: s.sku,
        metrics: { revenue: s.revenue, ads: s.ads, roas: s.roas, cpa: s.cpa,
                   impressions: s.impressions, clicks: s.clicks, conversions: s.conversions },
      })),
    ).catch((e: unknown) => console.error("Intelligence: snapshot persist error:", e));
  }

  return NextResponse.json(result);
  } catch (err) {
    console.error("Intelligence GET: uncaught error:", err);
    return NextResponse.json({ error: "Erro interno", detail: String(err) }, { status: 500 });
  }
}

/* =========================
   POST /api/intelligence/action
   Body: { insightId, actionType, description }
========================= */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { insightId, actionType, description } = body as {
    insightId?: string;
    actionType: string;
    description: string;
  };

  if (!actionType || !description) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const log = await prisma.actionLog.create({
    data: {
      tenantId: session.tenantId,
      insightId: insightId ?? null,
      actionType,
      description,
    },
  });

  return NextResponse.json({ ok: true, id: log.id });
}
