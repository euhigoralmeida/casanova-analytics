import type {
  GSCKeywordRow,
  GSCPageRow,
  ScoredKeyword,
  ScoredPage,
  KeywordClassification,
  PageIssue,
  GA4OrganicLandingPage,
} from "./organic-types";

/* =========================
   Curva de CTR por posicao (Google e-commerce)
========================= */

const EXPECTED_CTR: Record<number, number> = {
  1: 0.318,
  2: 0.246,
  3: 0.185,
  4: 0.132,
  5: 0.095,
  6: 0.069,
  7: 0.051,
  8: 0.040,
  9: 0.032,
  10: 0.026,
};

export function getExpectedCtr(position: number): number {
  const pos = Math.round(Math.max(1, Math.min(position, 100)));
  if (EXPECTED_CTR[pos]) return EXPECTED_CTR[pos];
  if (pos <= 20) return 0.026 * (1 - (pos - 10) * 0.05);
  return 0.005;
}

/* =========================
   Estimativa de impacto R$ ao subir posicao
========================= */

export function estimateImpactBRL(
  impressions: number,
  currentPosition: number,
  targetPosition: number,
  convRate: number,
  avgTicket: number,
  marginPct: number,
): number {
  const currentCtr = getExpectedCtr(currentPosition);
  const targetCtr = getExpectedCtr(targetPosition);
  const extraClicks = impressions * Math.max(0, targetCtr - currentCtr);
  const extraConversions = extraClicks * convRate;
  return Math.round(extraConversions * avgTicket * marginPct * 100) / 100;
}

/* =========================
   Keyword Score (0-100) — 8 dimensoes
========================= */

type KeywordScoringContext = {
  maxImpressions: number;
  targetConvRate: number;
  avgTicket: number;
  maxChannelLTV: number;
  organicLTV: number;
};

function positionGapScore(position: number): number {
  if (position >= 4 && position <= 10) return 100;
  if (position <= 3) return 30;
  if (position >= 11 && position <= 20) return 70;
  if (position >= 21 && position <= 50) return 40;
  return 10;
}

export function scoreKeyword(
  keyword: GSCKeywordRow & {
    pageConvRate?: number;
    marginPct?: number;
    hasStock?: boolean;
    deltaPosition?: number;
    landingPage?: string;
  },
  ctx: KeywordScoringContext,
): { score: number; estimatedRevenue: number; estimatedImpactBRL: number; classification: KeywordClassification } {
  const convRate = keyword.pageConvRate ?? ctx.targetConvRate;
  const margin = keyword.marginPct ?? 0.30;

  // 1. Volume (10%)
  const volumeScore = ctx.maxImpressions > 0
    ? (keyword.impressions / ctx.maxImpressions) * 100
    : 0;

  // 2. Receita potencial (20%)
  const potentialRevenue = keyword.clicks * convRate * ctx.avgTicket * margin;
  const revScoreRaw = Math.min(100, potentialRevenue / 100); // R$100 = 100 score
  const revenueScore = revScoreRaw;

  // 3. Conversao da landing page (15%)
  const convScore = ctx.targetConvRate > 0
    ? Math.min(100, (convRate / ctx.targetConvRate) * 100)
    : 50;

  // 4. Gap de posicao (20%)
  const gapScore = positionGapScore(keyword.position);

  // 5. LTV do canal organico (10%)
  const ltvScore = ctx.maxChannelLTV > 0
    ? Math.min(100, (ctx.organicLTV / ctx.maxChannelLTV) * 100)
    : 50;

  // 6. Margem do produto (10%)
  const marginScore = Math.min(100, (margin / 0.50) * 100);

  // 7. Estoque (5%)
  const stockScore = keyword.hasStock !== false ? 100 : 0;

  // 8. Competicao — CTR vs esperado (10%)
  const expected = getExpectedCtr(keyword.position);
  const ctrScore = expected > 0
    ? Math.min(100, (keyword.ctr / expected) * 100)
    : 50;

  const score = Math.round(
    volumeScore * 0.10 +
    revenueScore * 0.20 +
    convScore * 0.15 +
    gapScore * 0.20 +
    ltvScore * 0.10 +
    marginScore * 0.10 +
    stockScore * 0.05 +
    ctrScore * 0.10
  );

  // Estimated current revenue
  const estimatedRevenue = Math.round(keyword.clicks * convRate * ctx.avgTicket * 100) / 100;

  // Impact estimate: what if position improved to top-3?
  const targetPos = Math.min(3, Math.max(1, keyword.position - 3));
  const impact = estimateImpactBRL(
    keyword.impressions,
    keyword.position,
    targetPos,
    convRate,
    ctx.avgTicket,
    margin,
  );

  // Classification
  const dp = keyword.deltaPosition ?? 0;
  let classification: KeywordClassification;

  if (keyword.position <= 5 && estimatedRevenue > 0 && score >= 60) {
    classification = "proteger";
  } else if (score >= 70 && keyword.position >= 4 && keyword.position <= 20) {
    classification = "escalar";
  } else if (dp < -3 && keyword.position <= 30 && keyword.clicks > 5) {
    // Position dropped more than 3 positions (deltaPosition is prev - current, drop means negative)
    classification = "recuperar";
  } else if (score >= 40 && score < 60 && keyword.clicks < 10) {
    classification = "testar";
  } else if (score < 30 || (keyword.position > 50 && estimatedRevenue === 0)) {
    classification = "ignorar";
  } else {
    // Default based on score
    classification = score >= 60 ? "escalar" : score >= 30 ? "testar" : "ignorar";
  }

  return { score, estimatedRevenue, estimatedImpactBRL: impact, classification };
}

/* =========================
   Page Score (0-100) — 7 dimensoes
========================= */

type PageScoringContext = {
  maxClicks: number;
  maxRevenue: number;
  avgSiteConvRate: number;
  avgAddToCartRate: number;
};

export function scorePage(
  page: GSCPageRow & {
    ga4?: GA4OrganicLandingPage;
    keywordCount: number;
    avgKeywordPosition: number;
  },
  ctx: PageScoringContext,
): { score: number; issues: PageIssue[] } {
  const ga4 = page.ga4;
  const sessions = ga4?.sessions ?? 0;
  const revenue = ga4?.revenue ?? 0;
  const convRate = sessions > 0 && ga4 ? ga4.conversions / sessions : 0;
  const addToCartRate = sessions > 0 && ga4 ? ga4.addToCarts / sessions : 0;
  const bounceRate = ga4?.bounceRate ?? 0;

  // 1. Trafego organico (15%)
  const trafficScore = ctx.maxClicks > 0
    ? Math.min(100, (page.clicks / ctx.maxClicks) * 100)
    : 0;

  // 2. Receita organica (25%)
  const revenueScore = ctx.maxRevenue > 0
    ? Math.min(100, (revenue / ctx.maxRevenue) * 100)
    : 0;

  // 3. Conversao vs media do site (20%)
  const convVsAvg = ctx.avgSiteConvRate > 0
    ? Math.min(100, (convRate / ctx.avgSiteConvRate) * 100)
    : 50;

  // 4. Profundidade funil — add-to-cart rate (15%)
  const funnelScore = ctx.avgAddToCartRate > 0
    ? Math.min(100, (addToCartRate / ctx.avgAddToCartRate) * 100)
    : 50;

  // 5. Margem media dos produtos (10%) — not available without SKU match, use default
  const marginScore = 60;

  // 6. Posicao media dos keywords (10%)
  const posScore = page.avgKeywordPosition > 0
    ? Math.min(100, Math.max(0, (50 - page.avgKeywordPosition) * 2))
    : 50;

  // 7. Quantidade de keywords ranqueando (5%)
  const kwCountScore = Math.min(100, page.keywordCount * 5);

  const score = Math.round(
    trafficScore * 0.15 +
    revenueScore * 0.25 +
    convVsAvg * 0.20 +
    funnelScore * 0.15 +
    marginScore * 0.10 +
    posScore * 0.10 +
    kwCountScore * 0.05
  );

  // Issue detection
  const issues: PageIssue[] = [];

  if (page.clicks > 50 && convRate < ctx.avgSiteConvRate * 0.5) {
    issues.push("high_traffic_low_conv");
  }
  if (bounceRate > 70 && page.clicks > 20) {
    issues.push("high_bounce");
  }
  const expectedCtr = getExpectedCtr(page.position);
  if (page.ctr < expectedCtr * 0.5 && page.impressions > 100) {
    issues.push("unexploited");
  }

  return { score, issues };
}

/* =========================
   Batch scoring helpers
========================= */

export function scoreAllKeywords(
  keywords: (GSCKeywordRow & {
    pageConvRate?: number;
    marginPct?: number;
    hasStock?: boolean;
    deltaPosition?: number;
    landingPage?: string;
  })[],
  ctx: KeywordScoringContext,
): ScoredKeyword[] {
  return keywords.map((kw) => {
    const { score, estimatedRevenue, estimatedImpactBRL, classification } = scoreKeyword(kw, ctx);
    return {
      ...kw,
      score,
      classification,
      estimatedRevenue,
      estimatedImpactBRL,
      deltaCtr: kw.ctr - getExpectedCtr(kw.position),
    };
  }).sort((a, b) => b.score - a.score);
}

export function scoreAllPages(
  pages: (GSCPageRow & {
    ga4?: GA4OrganicLandingPage;
    keywordCount: number;
    avgKeywordPosition: number;
  })[],
  ctx: PageScoringContext,
): ScoredPage[] {
  return pages.map((p) => {
    const { score, issues } = scorePage(p, ctx);
    const ga4 = p.ga4;
    const sessions = ga4?.sessions ?? 0;
    const convRate = sessions > 0 && ga4 ? ga4.conversions / sessions : 0;
    const addToCartRate = sessions > 0 && ga4 ? ga4.addToCarts / sessions : 0;

    // Normalize URL to path
    let path = p.page;
    try {
      path = new URL(p.page).pathname;
    } catch { /* keep as-is */ }

    return {
      path,
      fullUrl: p.page,
      score,
      clicks: p.clicks,
      impressions: p.impressions,
      position: p.position,
      ctr: p.ctr,
      sessions,
      revenue: ga4?.revenue ?? 0,
      conversions: ga4?.conversions ?? 0,
      convRate: Math.round(convRate * 10000) / 100,
      bounceRate: ga4?.bounceRate ?? 0,
      addToCarts: ga4?.addToCarts ?? 0,
      addToCartRate: Math.round(addToCartRate * 10000) / 100,
      keywordCount: p.keywordCount,
      avgKeywordPosition: p.avgKeywordPosition,
      issues,
    };
  }).sort((a, b) => b.score - a.score);
}
