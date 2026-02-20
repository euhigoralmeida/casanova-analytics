import { NextRequest, NextResponse } from "next/server";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchGA4FunnelTimeSeries, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { isClarityConfigured, getClarityDashboardUrl, fetchClarityInsights } from "@/lib/clarity";
import { requireAuth } from "@/lib/api-helpers";
import type { CRODataResponse } from "@/types/api";


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

  // Nothing configured — return empty not_configured response
  if (!ga4Ready && !clarityReady) {
    const empty: CRODataResponse = {
      source: "not_configured",
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(empty, { status: 200 });
  }

  try {
    // Parallel fetch: GA4 + Clarity
    const [ga4Result, clarityResult] = await Promise.all([
      ga4Ready ? fetchGA4Data(startDate, endDate) : Promise.resolve(null),
      clarityReady ? fetchClarityInsights(3) : Promise.resolve(null),
    ]);

    // Clarity with real data?
    const clarityHasData = clarityResult && clarityResult.source === "clarity";

    const source: CRODataResponse["source"] =
      ga4Result && clarityHasData ? "full" :
      ga4Result ? "ga4_only" :
      clarityHasData ? "clarity_only" :
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

    // Always pass clarity result so frontend can show rate_limited/not_configured message
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
