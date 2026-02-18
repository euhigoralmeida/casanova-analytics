import { NextRequest, NextResponse } from "next/server";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchGA4FunnelTimeSeries, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { isClarityConfigured, getClarityDashboardUrl, fetchClarityInsights } from "@/lib/clarity";
import { requireAuth } from "@/lib/api-helpers";
import type { CRODataResponse } from "@/types/api";

/* =========================
   Mock data for when nothing is configured
========================= */

function generateMockData(): CRODataResponse {
  return {
    source: "not_configured",
    updatedAt: new Date().toISOString(),
    funnel: [
      { eventName: "page_view", step: "Visualização", count: 12500, rate: 100, dropoff: 0 },
      { eventName: "view_item", step: "Produto", count: 6200, rate: 49.6, dropoff: 50.4 },
      { eventName: "add_to_cart", step: "Carrinho", count: 1850, rate: 29.8, dropoff: 70.2 },
      { eventName: "begin_checkout", step: "Checkout", count: 980, rate: 53.0, dropoff: 47.0 },
      { eventName: "add_shipping_info", step: "Envio", count: 780, rate: 79.6, dropoff: 20.4 },
      { eventName: "add_payment_info", step: "Pagamento", count: 650, rate: 83.3, dropoff: 16.7 },
      { eventName: "purchase", step: "Compra", count: 520, rate: 80.0, dropoff: 20.0 },
    ],
    overallConversionRate: 4.16,
    summary: {
      sessions: 18420,
      users: 12500,
      newUsers: 8900,
      purchases: 520,
      purchaseRevenue: 148750,
      bounceRate: 42.3,
      engagedSessions: 10650,
      avgOrderValue: 286.06,
      cartAbandonmentRate: 47.03,
      checkoutAbandonmentRate: 20.0,
    },
    channelAcquisition: [
      { channel: "Paid Shopping", sessions: 6200, users: 4100, newUsers: 3200, conversions: 215, revenue: 61500 },
      { channel: "Organic Search", sessions: 4800, users: 3500, newUsers: 2400, conversions: 125, revenue: 35800 },
      { channel: "Direct", sessions: 3100, users: 2200, newUsers: 1100, conversions: 85, revenue: 24300 },
      { channel: "Paid Search", sessions: 2400, users: 1600, newUsers: 1200, conversions: 55, revenue: 15700 },
      { channel: "Organic Social", sessions: 1200, users: 700, newUsers: 600, conversions: 25, revenue: 7200 },
      { channel: "Email", sessions: 720, users: 400, newUsers: 400, conversions: 15, revenue: 4250 },
    ],
  };
}

/* =========================
   GET /api/cro
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const ga4Ready = isGA4Configured();
  const clarityReady = isClarityConfigured();

  // Nothing configured — return mock data
  if (!ga4Ready && !clarityReady) {
    return NextResponse.json(generateMockData(), { status: 200 });
  }

  try {
    // Parallel fetch: GA4 + Clarity
    const [ga4Result, clarityResult] = await Promise.all([
      ga4Ready ? fetchGA4Data(startDate, endDate) : Promise.resolve(null),
      clarityReady ? fetchClarityInsights(3).catch((err) => { console.error("Clarity fetch error:", err); return null; }) : Promise.resolve(null),
    ]);

    const source: CRODataResponse["source"] =
      ga4Result && clarityResult ? "full" :
      ga4Result ? "ga4_only" :
      clarityResult ? "clarity_only" :
      "not_configured";

    const response: CRODataResponse = {
      source,
      updatedAt: new Date().toISOString(),
    };

    if (ga4Result) {
      response.funnel = ga4Result.funnel;
      response.overallConversionRate = ga4Result.overallConversionRate;
      response.summary = ga4Result.summary;
      response.dailySeries = ga4Result.dailySeries;
      response.channelAcquisition = ga4Result.channelAcquisition;
    }

    if (clarityResult) {
      response.clarity = clarityResult;
      response.clarityDashboardUrl = getClarityDashboardUrl();
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("CRO API error:", err);
    return NextResponse.json({ source: "error", error: "Erro interno ao buscar dados CRO" }, { status: 500 });
  }
}

/* =========================
   GA4 data fetcher
========================= */

async function fetchGA4Data(startDate: string, endDate: string) {
  const client = getGA4Client();

  const [funnelData, summary, dailySeries, channelAcquisition] = await Promise.all([
    fetchEcommerceFunnel(client, startDate, endDate),
    fetchGA4Summary(client, startDate, endDate),
    fetchGA4FunnelTimeSeries(client, startDate, endDate),
    fetchChannelAcquisition(client, startDate, endDate),
  ]);

  const funnel = funnelData.funnel;
  const topCount = funnel[0]?.count ?? 0;
  const purchaseCount = funnel[funnel.length - 1]?.count ?? 0;
  const overallConversionRate = topCount > 0 ? Math.round((purchaseCount / topCount) * 10000) / 100 : 0;

  return {
    funnel,
    overallConversionRate,
    summary,
    dailySeries,
    channelAcquisition,
  };
}
