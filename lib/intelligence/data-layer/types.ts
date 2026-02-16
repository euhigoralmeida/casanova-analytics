/* =========================
   Data Layer Types — DataCube
   Estrutura unificada de dados para o Motor Cognitivo
========================= */

import type { TrendData } from "./trend-analyzer";

export type CubeMeta = {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  dayOfMonth: number;
  daysInMonth: number;
};

export type AccountSlice = {
  ads: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
};

export type SkuSlice = {
  sku: string;
  nome: string;
  revenue: number;
  ads: number;
  roas: number;
  cpa: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  convRate: number;
  status: "escalar" | "manter" | "pausar";
  // Profitability
  marginPct: number;
  stock: number;
  grossProfit: number;     // revenue * marginPct
  profitAfterAds: number;  // grossProfit - ads
  // Share of total
  revenueShare: number;    // % of total revenue
  adsShare: number;        // % of total spend
  // Trend (populated from historical snapshots)
  trend?: TrendData;
};

export type CampaignSlice = {
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

export type GA4Slice = {
  sessions: number;
  users: number;
  purchases: number;
  purchaseRevenue: number;
  bounceRate: number;
  engagedSessions: number;
  cartAbandonmentRate: number;
  // Derived
  conversionRate: number;  // purchases / sessions
  avgOrderValue: number;   // purchaseRevenue / purchases
};

export type ChannelSlice = {
  channel: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  sessionShare: number;    // % of total sessions
  conversionRate: number;  // conversions / sessions
};

export type PlanningSlice = {
  receita_captada?: number;
  receita_faturada?: number;
  receita_cancelada?: number;
  investimento_ads?: number;
  google_ads?: number;
  roas_captado?: number;
  roas_pago?: number;
  taxa_conversao_captado?: number;
  cpa_geral?: number;
  sessoes_totais?: number;
  pedido_captado?: number;
  ticket_medio_captado?: number;
  pct_aprovacao_receita?: number;
};

export type DeviceSlice = {
  device: string; // "DESKTOP" | "MOBILE" | "TABLET" | ...
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  costBRL: number;
  roas: number;
  cpa: number;
  ctr: number;
  convRate: number;
  revenueShare: number;
};

export type DemographicSlice = {
  segment: string; // "AGE_RANGE_18_24", "MALE", etc.
  type: "age" | "gender";
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  costBRL: number;
  roas: number;
  cpa: number;
  ctr: number;
  revenueShare: number;
};

export type GeographicSlice = {
  region: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  costBRL: number;
  roas: number;
  cpa: number;
  ctr: number;
  revenueShare: number;
};

/**
 * DataCube — Estrutura centralizada consumida por todas as camadas do Motor Cognitivo.
 * Substitui o AnalysisContext com dados enriquecidos e campos derivados.
 */
export type DataCube = {
  meta: CubeMeta;
  account?: AccountSlice;
  skus: SkuSlice[];
  campaigns: CampaignSlice[];
  ga4?: GA4Slice;
  channels: ChannelSlice[];
  planning: PlanningSlice;
  // Segmentation slices
  devices?: DeviceSlice[];
  demographics?: DemographicSlice[];
  geographic?: GeographicSlice[];
  // Trend data from historical snapshots
  trends?: {
    account?: TrendData;
    skus: Record<string, TrendData>;
  };
};
