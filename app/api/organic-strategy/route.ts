import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import { getGSCClientAsync } from "@/lib/google-search-console";
import { getGA4ClientAsync } from "@/lib/google-analytics";
import { getCustomerAsync, computeComparisonDates } from "@/lib/google-ads";
import { fetchKeywordsWithDelta, fetchPageMetrics } from "@/lib/gsc-queries";
import { fetchOrganicLandingPages, fetchOrganicSearchSummary, mergeOrganicData } from "@/lib/organic-intelligence";
import { fetchUserLifetimeValue, fetchGA4Summary } from "@/lib/ga4-queries";
import { fetchSearchTerms } from "@/lib/queries";
import { detectCannibalization } from "@/lib/organic-cannibalization";
import { generateOrganicStrategy } from "@/lib/organic-strategy";
import type { OrganicStrategyResponse } from "@/lib/organic-types";

/* =========================
   GET /api/organic-strategy
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
  try {
    await getGSCClientAsync(tenantId);
  } catch {
    const empty: OrganicStrategyResponse = {
      source: "not_configured",
      updatedAt: new Date().toISOString(),
      decisions: [],
      summary: { totalImpactBRL: 0, totalSavingsBRL: 0, growthPotentialBRL: 0 },
    };
    return NextResponse.json(empty, { status: 200 });
  }

  try {
    const { prevStart, prevEnd } = computeComparisonDates(startDate, endDate);

    const [keywordsWithDelta, gscPages, ga4Data, adsSearchTerms] = await Promise.all([
      fetchKeywordsWithDelta(startDate, endDate, prevStart, prevEnd, tenantId),
      fetchPageMetrics(startDate, endDate, tenantId),
      fetchGA4DataForStrategy(startDate, endDate, tenantId).catch(() => null),
      fetchAdsData(startDate, endDate, tenantId).catch(() => [] as Awaited<ReturnType<typeof fetchSearchTerms>>),
    ]);

    const avgTicket = ga4Data?.avgTicket ?? 150;
    const siteConvRate = ga4Data?.siteConvRate ?? 0.02;
    const totalRevenue = ga4Data?.totalRevenue ?? 0;

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

    const cannibalization = adsSearchTerms.length > 0
      ? detectCannibalization(keywordsWithDelta, adsSearchTerms)
      : [];

    const organicConvRate = ga4Data?.summary
      ? (ga4Data.summary.sessions > 0 ? ga4Data.summary.conversions / ga4Data.summary.sessions : 0.02)
      : 0.02;

    const strategy = generateOrganicStrategy({
      keywords,
      pages,
      cannibalization,
      avgTicket,
      organicConvRate,
      organicRevenue: ga4Data?.summary?.revenue ?? 0,
      totalRevenue,
    });

    return NextResponse.json(strategy);
  } catch (err) {
    console.error("Organic Strategy API error:", err);
    return NextResponse.json(
      { source: "error", error: "Erro interno ao gerar estrategia organica" },
      { status: 500 },
    );
  }
}

async function fetchGA4DataForStrategy(startDate: string, endDate: string, tenantId?: string) {
  const client = await getGA4ClientAsync(tenantId);
  const [landingPages, summary, channelLTV, siteSummary] = await Promise.all([
    fetchOrganicLandingPages(client, startDate, endDate).catch(() => []),
    fetchOrganicSearchSummary(client, startDate, endDate).catch(() => ({
      sessions: 0, users: 0, conversions: 0, revenue: 0, bounceRate: 0,
    })),
    fetchUserLifetimeValue(client, startDate, endDate, tenantId).catch(() => []),
    fetchGA4Summary(client, startDate, endDate, tenantId).catch(() => null),
  ]);

  const organicChannel = channelLTV.find((c) => c.channel === "Organic Search");
  return {
    landingPages,
    summary,
    organicLTV: organicChannel?.revenuePerPurchaser ?? 0,
    maxChannelLTV: Math.max(1, ...channelLTV.map((c) => c.revenuePerPurchaser)),
    totalRevenue: siteSummary?.purchaseRevenue ?? 0,
    avgTicket: siteSummary?.avgOrderValue ?? 150,
    siteConvRate: siteSummary && siteSummary.sessions > 0
      ? siteSummary.purchases / siteSummary.sessions
      : 0.02,
  };
}

async function fetchAdsData(startDate: string, endDate: string, tenantId?: string) {
  const customer = await getCustomerAsync(tenantId);
  return await fetchSearchTerms(customer, startDate, endDate);
}
