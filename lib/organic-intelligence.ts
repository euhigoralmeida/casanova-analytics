import type { BetaAnalyticsDataClient } from "@google-analytics/data";
import type {
  GSCKeywordRow,
  GSCPageRow,
  GA4OrganicLandingPage,
  GA4OrganicSummary,
  ScoredKeyword,
  ScoredPage,
} from "./organic-types";
import { scoreAllKeywords, scoreAllPages } from "./organic-scoring";
import { getPropertyId } from "./google-analytics";
import { getCached, setCache } from "./google-ads";

/* =========================
   GA4 Organic Landing Pages Query
========================= */

export async function fetchOrganicLandingPages(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4OrganicLandingPage[]> {
  const cacheKey = `ga4:org-lp:${startDate}:${endDate}`;
  const cached = getCached<GA4OrganicLandingPage[]>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
      { name: "bounceRate" },
      { name: "addToCarts" },
    ],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 500,
  });

  const rows: GA4OrganicLandingPage[] = (response.rows ?? []).map((row) => {
    const path = row.dimensionValues?.[0]?.value ?? "/";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    return {
      path,
      sessions: Math.round(vals[0] ?? 0),
      users: Math.round(vals[1] ?? 0),
      conversions: Math.round(vals[2] ?? 0),
      revenue: Math.round((vals[3] ?? 0) * 100) / 100,
      bounceRate: Math.round((vals[4] ?? 0) * 100) / 100,
      addToCarts: Math.round(vals[5] ?? 0),
    };
  });

  setCache(cacheKey, rows);
  return rows;
}

/* =========================
   GA4 Organic Search Summary
========================= */

export async function fetchOrganicSearchSummary(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4OrganicSummary> {
  const cacheKey = `ga4:org-sum:${startDate}:${endDate}`;
  const cached = getCached<GA4OrganicSummary>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
      { name: "bounceRate" },
    ],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
  });

  const row = response.rows?.[0];
  const vals = (row?.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));

  const result: GA4OrganicSummary = {
    sessions: Math.round(vals[0] ?? 0),
    users: Math.round(vals[1] ?? 0),
    conversions: Math.round(vals[2] ?? 0),
    revenue: Math.round((vals[3] ?? 0) * 100) / 100,
    bounceRate: Math.round((vals[4] ?? 0) * 100) / 100,
  };

  setCache(cacheKey, result);
  return result;
}

/* =========================
   Cross-Reference Engine
========================= */

function normalizeUrlToPath(fullUrl: string): string {
  try {
    return new URL(fullUrl).pathname;
  } catch {
    return fullUrl;
  }
}

type MergeContext = {
  gscKeywords: (GSCKeywordRow & { deltaPosition?: number })[];
  gscPages: GSCPageRow[];
  ga4LandingPages: GA4OrganicLandingPage[];
  ga4Summary: GA4OrganicSummary;
  organicLTV: number;
  maxChannelLTV: number;
  avgTicket: number;
  siteConvRate: number;
  totalRevenue: number;
};

export function mergeOrganicData(ctx: MergeContext): {
  keywords: ScoredKeyword[];
  pages: ScoredPage[];
} {
  // --- Page merge: GSC pages + GA4 landing pages ---
  const ga4Map = new Map<string, GA4OrganicLandingPage>();
  for (const lp of ctx.ga4LandingPages) {
    ga4Map.set(lp.path, lp);
  }

  // Build keyword-to-page lookup
  const keywordPageMap = new Map<string, string>();
  // For each GSC page, we'd ideally use fetchKeywordsByPage, but for batch,
  // we associate keywords to pages via GSC page data (top keyword per URL)

  // Calculate keyword counts per page
  const pageKeywordCounts = new Map<string, { count: number; totalPos: number }>();

  // First pass: build page-level stats from keywords
  // (In the absence of query+page combined dimension, approximate by page metrics)
  for (const page of ctx.gscPages) {
    const path = normalizeUrlToPath(page.page);
    pageKeywordCounts.set(path, { count: 0, totalPos: 0 });
  }

  // Score pages
  const pagesForScoring = ctx.gscPages.map((p) => {
    const path = normalizeUrlToPath(p.page);
    const ga4 = ga4Map.get(path);
    const kwInfo = pageKeywordCounts.get(path);
    return {
      ...p,
      ga4,
      keywordCount: kwInfo?.count ?? Math.round(Math.max(1, p.impressions / 100)),
      avgKeywordPosition: kwInfo?.count ? kwInfo.totalPos / kwInfo.count : p.position,
    };
  });

  const maxPageClicks = Math.max(1, ...pagesForScoring.map((p) => p.clicks));
  const maxPageRevenue = Math.max(1, ...ctx.ga4LandingPages.map((p) => p.revenue));
  const totalSessions = ctx.ga4LandingPages.reduce((s, p) => s + p.sessions, 0);
  const totalConversions = ctx.ga4LandingPages.reduce((s, p) => s + p.conversions, 0);
  const avgSiteConvRate = totalSessions > 0 ? totalConversions / totalSessions : ctx.siteConvRate;
  const totalAddToCarts = ctx.ga4LandingPages.reduce((s, p) => s + p.addToCarts, 0);
  const avgAddToCartRate = totalSessions > 0 ? totalAddToCarts / totalSessions : 0.05;

  const scoredPages = scoreAllPages(pagesForScoring, {
    maxClicks: maxPageClicks,
    maxRevenue: maxPageRevenue,
    avgSiteConvRate,
    avgAddToCartRate,
  });

  // Build page path → convRate for keyword enrichment
  const pageConvRateMap = new Map<string, number>();
  for (const sp of scoredPages) {
    if (sp.sessions > 0) {
      pageConvRateMap.set(sp.path, sp.conversions / sp.sessions);
    }
  }

  // Associate keywords with their best landing page (approximate by matching)
  for (const kw of ctx.gscKeywords) {
    // Try to find page whose path contains keyword tokens
    // This is a simplified heuristic; production would use query+page GSC dimension
    for (const page of ctx.gscPages) {
      const path = normalizeUrlToPath(page.page).toLowerCase();
      const tokens = kw.query.toLowerCase().split(/\s+/);
      const matchCount = tokens.filter((t) => t.length > 3 && path.includes(t)).length;
      if (matchCount >= Math.max(1, tokens.length * 0.5)) {
        keywordPageMap.set(kw.query, normalizeUrlToPath(page.page));
        const stats = pageKeywordCounts.get(normalizeUrlToPath(page.page));
        if (stats) {
          stats.count++;
          stats.totalPos += kw.position;
        }
        break;
      }
    }
  }

  // Score keywords
  const maxImpressions = Math.max(1, ...ctx.gscKeywords.map((k) => k.impressions));
  const organicConvRate = ctx.ga4Summary.sessions > 0
    ? ctx.ga4Summary.conversions / ctx.ga4Summary.sessions
    : ctx.siteConvRate;

  const keywordsForScoring = ctx.gscKeywords.map((kw) => {
    const pagePath = keywordPageMap.get(kw.query);
    const convRate = pagePath ? pageConvRateMap.get(pagePath) : undefined;
    return {
      ...kw,
      pageConvRate: convRate ?? organicConvRate,
      landingPage: pagePath,
    };
  });

  const scoredKeywords = scoreAllKeywords(keywordsForScoring, {
    maxImpressions,
    targetConvRate: organicConvRate,
    avgTicket: ctx.avgTicket,
    maxChannelLTV: ctx.maxChannelLTV,
    organicLTV: ctx.organicLTV,
  });

  return { keywords: scoredKeywords, pages: scoredPages };
}
