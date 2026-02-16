/* =========================
   Intelligence Engine Types
========================= */

export type InsightCategory =
  | "planning_gap"
  | "efficiency"
  | "opportunity"
  | "risk"
  | "composition";

export type InsightSeverity = "success" | "warning" | "danger";

export type InsightSource = "planning" | "alert" | "pattern";

export type RecommendationImpact = "high" | "medium" | "low";

export type Recommendation = {
  action: string;
  impact: RecommendationImpact;
  effort: "low" | "medium" | "high";
  steps?: string[];
};

export type InsightMetrics = {
  current?: number;
  target?: number;
  gap?: number; // percentage
  trendPct?: number;
  previous?: number;
  entityName?: string;
};

export type IntelligenceInsight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metrics: InsightMetrics;
  recommendations: Recommendation[];
  source: InsightSource;
};

export type IntelligenceSummary = {
  healthScore: number; // 0-100
  topPriority: IntelligenceInsight | null;
  quickWins: IntelligenceInsight[];
};

export type IntelligenceResponse = {
  insights: IntelligenceInsight[];
  summary: IntelligenceSummary;
  generatedAt: string;
};

/* =========================
   Analysis Context — data passed to analyzers
========================= */

export type PlanningMetrics = {
  receita_captada?: number;
  receita_faturada?: number;
  receita_cancelada?: number;
  google_ads?: number;
  meta_ads?: number;
  usuarios_visitantes?: number;
  sessoes_totais?: number;
  sessoes_midia?: number;
  sessoes_engajadas?: number;
  taxa_rejeicao?: number;
  pedido_captado?: number;
  pedido_pago?: number;
  carrinhos_criados?: number;
  investimento_ads?: number;
  roas_captado?: number;
  roas_pago?: number;
  cpa_geral?: number;
  taxa_conversao_captado?: number;
  ticket_medio_captado?: number;
  pct_aprovacao_receita?: number;
};

export type AccountMetrics = {
  ads: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
};

export type SkuMetrics = {
  sku: string;
  nome: string;
  revenue: number;
  ads: number;
  roas: number;
  cpa: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: "escalar" | "manter" | "pausar";
};

export type CampaignMetrics = {
  campaignId: string;
  campaignName: string;
  channelType: string;
  status: string;
  costBRL: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type GA4Metrics = {
  sessions: number;
  users: number;
  purchases: number;
  purchaseRevenue: number;
  bounceRate: number;
  engagedSessions: number;
  cartAbandonmentRate: number;
};

export type ChannelData = {
  channel: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
};

export type AnalysisContext = {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  dayOfMonth: number;
  daysInMonth: number;
  account?: AccountMetrics;
  skus: SkuMetrics[];
  campaigns: CampaignMetrics[];
  ga4?: GA4Metrics;
  channels: ChannelData[];
  planning: PlanningMetrics;
};
