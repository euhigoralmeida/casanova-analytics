/* =========================
   Tipos do modulo Inteligencia Organica
========================= */

// --- GSC Raw Data ---

export type GSCKeywordRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;       // 0-1
  position: number;
};

export type GSCPageRow = {
  page: string;       // full URL
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCDailyPoint = {
  date: string;       // yyyy-mm-dd
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

// --- GA4 Organic Landing Page ---

export type GA4OrganicLandingPage = {
  path: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  bounceRate: number;
  addToCarts: number;
};

export type GA4OrganicSummary = {
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  bounceRate: number;
};

// --- Scored / Enriched ---

export type KeywordClassification = "proteger" | "escalar" | "recuperar" | "testar" | "ignorar";

export type ScoredKeyword = GSCKeywordRow & {
  score: number;                // 0-100
  classification: KeywordClassification;
  estimatedRevenue: number;     // R$ estimado atual
  estimatedImpactBRL: number;   // R$ impacto se subir posicao
  landingPage?: string;
  pageConvRate?: number;
  deltaCtr?: number;            // vs expected CTR
  deltaPosition?: number;       // mudanca de posicao vs periodo anterior
};

export type PageIssue = "high_traffic_low_conv" | "high_bounce" | "unexploited" | "ranking_drop";

export type ScoredPage = {
  path: string;
  fullUrl: string;
  score: number;              // 0-100
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
  // GA4 enrichment
  sessions: number;
  revenue: number;
  conversions: number;
  convRate: number;
  bounceRate: number;
  addToCarts: number;
  addToCartRate: number;
  // Scoring
  keywordCount: number;
  avgKeywordPosition: number;
  issues: PageIssue[];
};

// --- Cannibalization ---

export type CannibalizationType = "full_cannibal" | "partial_overlap" | "dual_dominance";

export type CannibalizationEntry = {
  keyword: string;
  organicPosition: number;
  organicClicks: number;
  organicImpressions: number;
  paidClicks: number;
  paidCostBRL: number;
  paidConversions: number;
  paidRevenue: number;
  type: CannibalizationType;
  estimatedSavingsBRL: number;
  matchType: "exact" | "fuzzy";
};

// --- Strategy ---

export type EffortLevel = "baixo" | "medio" | "alto";
export type UrgencyLevel = "imediata" | "esta_semana" | "este_mes";

export type StrategicDecision = {
  id: string;
  action: string;
  detail: string;
  estimatedImpactBRL: number;
  effort: EffortLevel;
  urgency: UrgencyLevel;
  metricsToWatch: string[];
  antiRecommendation: string;
  connectionToPaid: string;
  connectionToCRO: string;
};

// --- API Responses ---

export type OrganicDataResponse = {
  source: "gsc" | "not_configured";
  updatedAt?: string;
  summary?: {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
    avgCtr: number;
    organicRevenue: number;
    organicRevenueShare: number;  // % da receita total
  };
  keywords?: ScoredKeyword[];
  pages?: ScoredPage[];
  dailySeries?: GSCDailyPoint[];
  cannibalization?: CannibalizationEntry[];
  cannibalizationSummary?: {
    totalEntries: number;
    totalSavingsBRL: number;
    fullCannibals: number;
  };
};

export type OrganicStrategyResponse = {
  source: "computed" | "not_configured";
  updatedAt?: string;
  decisions: StrategicDecision[];
  summary: {
    totalImpactBRL: number;
    totalSavingsBRL: number;
    growthPotentialBRL: number;
  };
};
