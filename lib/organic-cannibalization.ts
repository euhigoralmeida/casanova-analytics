import type { GSCKeywordRow, CannibalizationEntry, CannibalizationType } from "./organic-types";

/* =========================
   Search Terms from Google Ads
========================= */

export type AdsSearchTerm = {
  searchTerm: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

/* =========================
   Token-based fuzzy matching
========================= */

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\u00e0-\u00fc\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) matches++;
  }
  return matches / Math.max(tokensA.size, tokensB.size);
}

/* =========================
   Classify cannibalization type
========================= */

function classifyCannibalization(
  organicPosition: number,
  organicClicks: number,
  paidRevenue: number,
): CannibalizationType {
  // Organic top-3 and paid also competing → full cannibal
  if (organicPosition <= 3 && organicClicks > 0) {
    return "full_cannibal";
  }
  // Both generating revenue → dual dominance
  if (paidRevenue > 0 && organicClicks > 5) {
    return "dual_dominance";
  }
  // Organic 4-10 with paid → partial overlap
  return "partial_overlap";
}

/* =========================
   Estimate savings
========================= */

function estimateSavings(type: CannibalizationType, paidCostBRL: number): number {
  switch (type) {
    case "full_cannibal":
      return Math.round(paidCostBRL * 0.80 * 100) / 100;
    case "partial_overlap":
      return Math.round(paidCostBRL * 0.40 * 100) / 100;
    case "dual_dominance":
      return 0; // Both add value
  }
}

/* =========================
   Detect cannibalization
========================= */

export function detectCannibalization(
  gscKeywords: GSCKeywordRow[],
  adsSearchTerms: AdsSearchTerm[],
): CannibalizationEntry[] {
  const entries: CannibalizationEntry[] = [];
  const matchedAds = new Set<number>();

  // Build maps for efficient lookup
  const adsLower = adsSearchTerms.map((t, i) => ({
    ...t,
    lower: t.searchTerm.toLowerCase().trim(),
    idx: i,
  }));

  const adsExactMap = new Map<string, typeof adsLower[number][]>();
  for (const a of adsLower) {
    const list = adsExactMap.get(a.lower) ?? [];
    list.push(a);
    adsExactMap.set(a.lower, list);
  }

  // Pass 1: Exact match (case-insensitive)
  for (const kw of gscKeywords) {
    const query = kw.query.toLowerCase().trim();
    const matches = adsExactMap.get(query);
    if (!matches) continue;

    // Aggregate all ad matches for this keyword
    let totalClicks = 0, totalCost = 0, totalConv = 0, totalRev = 0;
    for (const m of matches) {
      totalClicks += m.clicks;
      totalCost += m.costBRL;
      totalConv += m.conversions;
      totalRev += m.revenue;
      matchedAds.add(m.idx);
    }

    const type = classifyCannibalization(kw.position, kw.clicks, totalRev);
    entries.push({
      keyword: kw.query,
      organicPosition: kw.position,
      organicClicks: kw.clicks,
      organicImpressions: kw.impressions,
      paidClicks: totalClicks,
      paidCostBRL: Math.round(totalCost * 100) / 100,
      paidConversions: totalConv,
      paidRevenue: Math.round(totalRev * 100) / 100,
      type,
      estimatedSavingsBRL: estimateSavings(type, totalCost),
      matchType: "exact",
    });
  }

  // Pass 2: Fuzzy match (token overlap >= 70%)
  const unmatchedAds = adsLower.filter((a) => !matchedAds.has(a.idx));
  const matchedGsc = new Set(entries.map((e) => e.keyword.toLowerCase()));

  for (const kw of gscKeywords) {
    if (matchedGsc.has(kw.query.toLowerCase())) continue;
    if (kw.clicks < 3) continue; // Skip very low-traffic keywords

    for (const ad of unmatchedAds) {
      if (matchedAds.has(ad.idx)) continue;
      const overlap = tokenOverlap(kw.query, ad.searchTerm);
      if (overlap < 0.7) continue;

      const type = classifyCannibalization(kw.position, kw.clicks, ad.revenue);
      entries.push({
        keyword: kw.query,
        organicPosition: kw.position,
        organicClicks: kw.clicks,
        organicImpressions: kw.impressions,
        paidClicks: ad.clicks,
        paidCostBRL: Math.round(ad.costBRL * 100) / 100,
        paidConversions: ad.conversions,
        paidRevenue: Math.round(ad.revenue * 100) / 100,
        type,
        estimatedSavingsBRL: estimateSavings(type, ad.costBRL),
        matchType: "fuzzy",
      });
      matchedAds.add(ad.idx);
      break; // One match per GSC keyword
    }
  }

  // Sort by savings descending
  entries.sort((a, b) => b.estimatedSavingsBRL - a.estimatedSavingsBRL);
  return entries;
}
