/* =========================
   Tipos da API — extraídos de page.tsx
========================= */

export type DateRange = {
  startDate: string; // yyyy-mm-dd
  endDate: string;
  label: string;
  preset?: string; // "7d" | "today" | "yesterday" | etc for API
};

export type ApiResponse = {
  sku: string;
  period: string;
  source: "google-ads" | "mock";
  skuTitle: string;
  updatedAt: string;
  cards: {
    roas: number;
    cpa: number;
    arpur: number;
    marginPct: number;
    revenue: number;
    ads: number;
    grossProfit: number;
    profitAfterAds: number;
    stock: number;
    leadTimeDays: number;
    cpc: number;
    cpm: number;
    conversions: number;
    clicks: number;
    convRate: number;
  };
  alerts: { title: string; description: string; severity: "danger" | "warn" | "info" }[];
  funnel: { etapa: string; qtd: number; taxa: number; custo: number | null }[];
};

export type OverviewResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  totalSkus: number;
  accountTotals?: {
    ads: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  shoppingTotals?: {
    ads: number;
    revenue: number;
  };
  meta: {
    revenueTarget: number;
    revenueCaptadaTarget?: number;
    revenueActual: number;
    adsTarget?: number;
    adsActual?: number;
    roasTarget: number;
    roasFaturadoTarget?: number;
    roasActual: number;
    marginTarget: number;
    marginActual: number;
    approvalRate?: number;
    pedidosCaptadosTarget?: number;
    ticketMedioTarget?: number;
  };
  skus: {
    sku: string;
    nome: string;
    revenue: number;
    ads: number;
    roas: number;
    cpa: number;
    marginPct: number;
    stock: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    status: "escalar" | "manter" | "pausar";
    campaignStatus?: "ENABLED" | "PAUSED";
    ml: { price: number; ecomPrice: number; mlSales: number };
  }[];
};

export type { SmartAlert, SmartAlertsResponse, AlertSeverity, AlertCategory } from "@/lib/alert-types";

export type CampaignData = {
  campaignId: string;
  campaignName: string;
  channelType: string;
  status: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  cpc: number;
  ctr: number;
};

export type CampaignsResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  campaigns: CampaignData[];
};

export type TimeSeriesPoint = {
  date: string;
  revenue: number;
  cost: number;
  roas: number;
  conversions: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
};

export type TimeSeriesResponse = {
  scope: string;
  sku?: string;
  period: string;
  source: "google-ads" | "mock";
  series: TimeSeriesPoint[];
};

export type { GA4FunnelStep, GA4SummaryData, GA4DailyPoint, ChannelAcquisition, GA4DataResponse } from "@/lib/ga4-queries";
export type { CohortRetentionData, RetentionSummary, ChannelLTV, RetentionData } from "@/lib/ga4-queries";
export type { ClarityBehavioralMetrics, ClarityPageAnalysis, ClarityDeviceBreakdown, ClarityData, ClarityChannelBreakdown, ClarityCampaignBreakdown, ClarityTechBreakdown } from "@/lib/clarity";
export type { MetaAdsCampaign, MetaAccountTotals, MetaTimeSeriesPoint, MetaAdsResponse } from "@/lib/meta-ads";
export type { IGAccount, IGMedia, IGMediaInsights, IGDailyInsight, IGPeriodTotals, IGAudienceGenderAge, IGAudienceGeo, IGOnlineFollowers, IGInsightsResponse } from "@/lib/instagram";

/* =========================
   CRO Data Response (combined GA4 + Clarity)
========================= */

export type CRODataResponse = {
  source: "full" | "ga4_only" | "clarity_only" | "not_configured";
  updatedAt: string;
  // GA4 data
  funnel?: import("@/lib/ga4-queries").GA4FunnelStep[];
  overallConversionRate?: number;
  summary?: import("@/lib/ga4-queries").GA4SummaryData;
  dailySeries?: import("@/lib/ga4-queries").GA4DailyPoint[];
  channelAcquisition?: import("@/lib/ga4-queries").ChannelAcquisition[];
  // Clarity data
  clarity?: import("@/lib/clarity").ClarityData;
  clarityDashboardUrl?: string;
};

export type KpiStatus = "ok" | "warn" | "danger" | undefined;

/* =========================
   Planning types
========================= */

export const PLANNING_INPUT_METRICS = [
  "receita_captada",
  "descontos_cliente",
  "receita_faturada",
  "google_ads",
  "meta_ads",
  "usuarios_visitantes",
  "sessoes_totais",
  "sessoes_midia",
  "sessoes_organicas",
  "sessoes_engajadas",
  "taxa_rejeicao",
  "pedido_captado",
  "pedido_pago",
  "carrinhos_criados",
  "carrinhos_abandonados",
] as const;

export type PlanningInputMetric = (typeof PLANNING_INPUT_METRICS)[number];

export const PLANNING_CALC_METRICS = [
  "pct_descontos_cliente",
  "receita_faturada",
  "taxa_aprovacao_pedidos",
  "investimento_ads",
  "pct_investimento_acos",
  "sessoes_organicas",
  "pct_visitantes_carrinho",
  "pct_carrinho_pedido",
  "pct_carrinho_pedido_pago",
  "ticket_medio_captado",
  "ticket_medio_pago",
  "taxa_conversao_captado",
  "taxa_conversao_pago",
  "cps_geral",
  "cpa_geral",
  "roas_captado",
  "roas_pago",
  "pct_midia_captado",
  "pct_midia_pago",
  "share_participacao",
  "receita_erp_relacao_anterior",
] as const;

export type PlanningCalcMetric = (typeof PLANNING_CALC_METRICS)[number];

/** Values for a single month: metric key → number */
export type MonthlyValues = Partial<Record<string, number>>;

/** year data: month (1-12) → metric values */
export type PlanningYearData = Record<number, MonthlyValues>;

export type PlanningApiResponse = {
  year: number;
  entries: PlanningYearData;
};

export type PlanningRowFormat = "currency" | "percent" | "number" | "number2";

export type PlanningRowDef = {
  key: string;
  label: string;
  type: "input" | "calc";
  format: PlanningRowFormat;
  formula?: string;
};

/* =========================
   Planning Target types (Planejamento 2026)
========================= */

export const PLANNING_TARGET_INPUT_METRICS = [
  "pct_retencao",
  "pct_aprovacao_receita",
  "ticket_medio_real",
  "taxa_conversao_real",
  "investimento_total",
  "invest_midia_paga",
  "invest_grupos_email",
  "invest_impulsionamento",
  "sessoes_organicas",
  "cps_midia",
] as const;

export type PlanningTargetInputMetric = (typeof PLANNING_TARGET_INPUT_METRICS)[number];

/* =========================
   Recharts formatter types — lib uses `any` internally, safe to type as unknown
========================= */

/** Recharts Tooltip formatter callback */
export type RechartsFormatter = (value: unknown, name: unknown) => [string, string];

/** Recharts Tooltip labelFormatter callback */
export type RechartsLabelFormatter = (label: unknown) => string;

/** Recharts Legend formatter callback */
export type RechartsLegendFormatter = (value: unknown) => string;
