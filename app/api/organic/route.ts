import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import { getGSCClientAsync } from "@/lib/google-search-console";
import { getGA4ClientAsync } from "@/lib/google-analytics";
import { getCustomerAsync } from "@/lib/google-ads";
import { computeComparisonDates } from "@/lib/google-ads";
import { fetchKeywordsWithDelta, fetchPageMetrics, fetchDailyOrganicTrend } from "@/lib/gsc-queries";
import { fetchOrganicLandingPages, fetchOrganicSearchSummary, mergeOrganicData } from "@/lib/organic-intelligence";
import { fetchUserLifetimeValue, fetchGA4Summary } from "@/lib/ga4-queries";
import { fetchSearchTerms } from "@/lib/queries";
import { detectCannibalization } from "@/lib/organic-cannibalization";
import type { OrganicDataResponse } from "@/lib/organic-types";

/* =========================
   GET /api/organic
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = getEffectiveTenantId(auth.session);

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  // Try to get GSC client — if not configured, return empty
  let gscClient;
  try {
    gscClient = await getGSCClientAsync(tenantId);
  } catch {
    const empty: OrganicDataResponse = {
      source: "not_configured",
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(empty, { status: 200 });
  }

  try {
    // Comparison period for delta calculation
    const { prevStart, prevEnd } = computeComparisonDates(startDate, endDate);

    // Parallel fetch: GSC + GA4 + Ads search terms
    // Use void reference so TS knows gscClient was resolved (for type narrowing)
    void gscClient;

    const [keywordsWithDelta, gscPages, dailySeries, ga4Data, adsSearchTerms] = await Promise.all([
      fetchKeywordsWithDelta(startDate, endDate, prevStart, prevEnd, tenantId),
      fetchPageMetrics(startDate, endDate, tenantId),
      fetchDailyOrganicTrend(startDate, endDate, tenantId),
      fetchGA4DataForOrganic(startDate, endDate, tenantId).catch(() => null),
      fetchAdsSearchTerms(startDate, endDate, tenantId).catch(() => [] as Awaited<ReturnType<typeof fetchSearchTerms>>),
    ]);

    // GSC summary KPIs
    const totalClicks = keywordsWithDelta.reduce((s, k) => s + k.clicks, 0);
    const totalImpressions = keywordsWithDelta.reduce((s, k) => s + k.impressions, 0);
    const avgPosition = keywordsWithDelta.length > 0
      ? Math.round((keywordsWithDelta.reduce((s, k) => s + k.position * k.impressions, 0) / Math.max(1, totalImpressions)) * 10) / 10
      : 0;
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;

    // GA4 organic data
    const organicRevenue = ga4Data?.summary?.revenue ?? 0;
    const totalRevenue = ga4Data?.totalRevenue ?? 0;
    const organicRevenueShare = totalRevenue > 0
      ? Math.round((organicRevenue / totalRevenue) * 10000) / 100
      : 0;

    // Merge & score
    const avgTicket = ga4Data?.avgTicket ?? 150;
    const siteConvRate = ga4Data?.siteConvRate ?? 0.02;

    const { keywords, pages } = mergeOrganicData({
      gscKeywords: keywordsWithDelta,
      gscPages,
      ga4LandingPages: ga4Data?.landingPages ?? [],
      ga4Summary: ga4Data?.summary ?? { sessions: 0, users: 0, conversions: 0, revenue: 0, bounceRate: 0 },
      organicLTV: ga4Data?.organicLTV ?? 0,
      maxChannelLTV: ga4Data?.maxChannelLTV ?? 0,
      avgTicket,
      siteConvRate,
      totalRevenue,
    });

    // Cannibalization detection
    const cannibalization = adsSearchTerms.length > 0
      ? detectCannibalization(keywordsWithDelta, adsSearchTerms)
      : [];

    const totalSavings = cannibalization.reduce((s, c) => s + c.estimatedSavingsBRL, 0);
    const fullCannibals = cannibalization.filter((c) => c.type === "full_cannibal").length;

    const response: OrganicDataResponse = {
      source: "gsc",
      updatedAt: new Date().toISOString(),
      summary: {
        totalClicks,
        totalImpressions,
        avgPosition,
        avgCtr,
        organicRevenue,
        organicRevenueShare,
      },
      keywords,
      pages,
      dailySeries,
      cannibalization: cannibalization.slice(0, 50),
      cannibalizationSummary: {
        totalEntries: cannibalization.length,
        totalSavingsBRL: Math.round(totalSavings * 100) / 100,
        fullCannibals,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Organic API error:", err);
    return NextResponse.json(
      { source: "error", error: "Erro interno ao buscar dados organicos" },
      { status: 500 },
    );
  }
}

/* =========================
   GA4 data for organic module
========================= */

async function fetchGA4DataForOrganic(startDate: string, endDate: string, tenantId?: string) {
  const client = await getGA4ClientAsync(tenantId);

  const [landingPages, summary, channelLTV, siteSummary] = await Promise.all([
    fetchOrganicLandingPages(client, startDate, endDate).catch(() => []),
    fetchOrganicSearchSummary(client, startDate, endDate).catch(() => ({
      sessions: 0, users: 0, conversions: 0, revenue: 0, bounceRate: 0,
    })),
    fetchUserLifetimeValue(client, startDate, endDate, tenantId).catch(() => []),
    fetchGA4Summary(client, startDate, endDate, tenantId).catch(() => null),
  ]);

  // Extract organic LTV
  const organicChannel = channelLTV.find((c) => c.channel === "Organic Search");
  const organicLTV = organicChannel?.revenuePerPurchaser ?? 0;
  const maxChannelLTV = Math.max(1, ...channelLTV.map((c) => c.revenuePerPurchaser));

  // Site-wide metrics
  const totalRevenue = siteSummary?.purchaseRevenue ?? 0;
  const avgTicket = siteSummary?.avgOrderValue ?? 150;
  const siteConvRate = siteSummary && siteSummary.sessions > 0
    ? siteSummary.purchases / siteSummary.sessions
    : 0.02;

  return {
    landingPages,
    summary,
    organicLTV,
    maxChannelLTV,
    totalRevenue,
    avgTicket,
    siteConvRate,
  };
}

/* =========================
   Ads search terms
========================= */

async function fetchAdsSearchTerms(startDate: string, endDate: string, tenantId?: string) {
  const customer = await getCustomerAsync(tenantId);
  return await fetchSearchTerms(customer, startDate, endDate, tenantId);
}
