import { NextRequest, NextResponse } from "next/server";
import { getGA4ClientAsync } from "@/lib/google-analytics";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchGA4FunnelTimeSeries, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { getClarityDashboardUrl, getClarityFromDB } from "@/lib/clarity";
import { requireAuth, requireTenantContext } from "@/lib/api-helpers";
import type { CRODataResponse } from "@/types/api";
import { logger } from "@/lib/logger";


/* =========================
   GET /api/cro
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  try {
    // Parallel fetch: GA4 (live) + Clarity (from DB snapshot, tenant-aware)
    const [ga4Result, claritySnapshot] = await Promise.all([
      fetchGA4Data(startDate, endDate, tenantId).catch(() => null),
      getClarityFromDB(tenantId, 3).catch(() => null),
    ]);

    // Clarity has data in DB?
    const clarityHasData = !!claritySnapshot;
    const clarityResult = claritySnapshot?.data ?? undefined;

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

    if (clarityHasData) {
      response.clarityConfigured = true;
      response.clarity = clarityResult;
      response.clarityDashboardUrl = getClarityDashboardUrl();
      response.clarityFetchedAt = claritySnapshot!.fetchedAt.toISOString();
    }

    return NextResponse.json(response);
  } catch (err) {
    logger.error("CRO API error", { route: "/api/cro", tenantId }, err);
    return NextResponse.json({ source: "error", error: "Erro interno ao buscar dados CRO" }, { status: 500 });
  }
}

/* =========================
   GA4 data fetcher
========================= */

async function fetchGA4Data(startDate: string, endDate: string, tenantId?: string) {
  const client = await getGA4ClientAsync(tenantId);
  if (!client) return null;

  const [funnelData, summary, dailySeries, channelAcquisition] = await Promise.all([
    fetchEcommerceFunnel(client, startDate, endDate, tenantId),
    fetchGA4Summary(client, startDate, endDate, tenantId),
    fetchGA4FunnelTimeSeries(client, startDate, endDate, tenantId),
    fetchChannelAcquisition(client, startDate, endDate, tenantId),
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
