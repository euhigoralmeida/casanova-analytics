/* =========================
   DataCube Builder
   Monta o DataCube unificado a partir dos dados existentes.
   Substitui o assembly inline do /api/intelligence/route.ts
========================= */

import type {
  DataCube,
  AccountSlice,
  SkuSlice,
  CampaignSlice,
  GA4Slice,
  ChannelSlice,
  PlanningSlice,
  DeviceSlice,
  DemographicSlice,
  GeographicSlice,
} from "./types";
import type {
  AccountMetrics,
  SkuMetrics,
  CampaignMetrics,
  GA4Metrics,
  ChannelData,
  PlanningMetrics,
  DeviceData,
  DemographicData,
  GeographicData,
} from "../types";

/**
 * Constrói o DataCube a partir dos dados já fetchados.
 * (O fetch continua no route.ts — aqui fazemos enriquecimento e cálculos derivados.)
 */
export function buildDataCube(params: {
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
  skuExtras?: Record<string, { marginPct: number; stock: number }>;
  devices?: DeviceData[];
  demographics?: DemographicData[];
  geographic?: GeographicData[];
}): DataCube {
  const {
    tenantId, periodStart, periodEnd, daysInPeriod, dayOfMonth, daysInMonth,
    account, skus, campaigns, ga4, channels, planning, skuExtras,
    devices, demographics, geographic,
  } = params;

  // Account slice (pass-through)
  const accountSlice: AccountSlice | undefined = account
    ? { ...account }
    : undefined;

  // Total revenue/ads for share calculations
  const totalRevenue = skus.reduce((s, sk) => s + sk.revenue, 0);
  const totalAds = skus.reduce((s, sk) => s + sk.ads, 0);

  // SKU slices with derived fields
  const skuSlices: SkuSlice[] = skus.map((sk) => {
    const extras = skuExtras?.[sk.sku];
    const marginPct = extras?.marginPct ?? 30;
    const stock = extras?.stock ?? 0;
    const grossProfit = sk.revenue * (marginPct / 100);
    const profitAfterAds = grossProfit - sk.ads;
    const ctr = sk.impressions > 0 ? (sk.clicks / sk.impressions) * 100 : 0;
    const convRate = sk.clicks > 0 ? (sk.conversions / sk.clicks) * 100 : 0;

    return {
      sku: sk.sku,
      nome: sk.nome,
      revenue: sk.revenue,
      ads: sk.ads,
      roas: sk.roas,
      cpa: sk.cpa,
      impressions: sk.impressions,
      clicks: sk.clicks,
      conversions: sk.conversions,
      ctr,
      convRate,
      status: sk.status,
      marginPct,
      stock,
      grossProfit: Math.round(grossProfit * 100) / 100,
      profitAfterAds: Math.round(profitAfterAds * 100) / 100,
      revenueShare: totalRevenue > 0 ? Math.round((sk.revenue / totalRevenue) * 10000) / 100 : 0,
      adsShare: totalAds > 0 ? Math.round((sk.ads / totalAds) * 10000) / 100 : 0,
    };
  });

  // Campaign slices (pass-through)
  const campaignSlices: CampaignSlice[] = campaigns.map((c) => ({ ...c }));

  // GA4 slice with derived fields
  const ga4Slice: GA4Slice | undefined = ga4
    ? {
        ...ga4,
        conversionRate: ga4.sessions > 0 ? ga4.purchases / ga4.sessions : 0,
        avgOrderValue: ga4.purchases > 0 ? ga4.purchaseRevenue / ga4.purchases : 0,
      }
    : undefined;

  // Channel slices with derived fields
  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  const channelSlices: ChannelSlice[] = channels.map((c) => ({
    ...c,
    sessionShare: totalSessions > 0 ? Math.round((c.sessions / totalSessions) * 10000) / 100 : 0,
    conversionRate: c.sessions > 0 ? c.conversions / c.sessions : 0,
  }));

  // Planning slice (pass-through)
  const planningSlice: PlanningSlice = { ...planning };

  // Device slices with derived fields
  const totalDeviceRevenue = devices?.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const deviceSlices: DeviceSlice[] | undefined = devices?.map((d) => ({
    device: d.device,
    impressions: d.impressions,
    clicks: d.clicks,
    conversions: d.conversions,
    revenue: d.revenue,
    costBRL: d.costBRL,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    cpa: d.conversions > 0 ? Math.round((d.costBRL / d.conversions) * 100) / 100 : 0,
    ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
    convRate: d.clicks > 0 ? Math.round((d.conversions / d.clicks) * 10000) / 100 : 0,
    revenueShare: totalDeviceRevenue > 0 ? Math.round((d.revenue / totalDeviceRevenue) * 10000) / 100 : 0,
  }));

  // Demographic slices with derived fields
  const totalDemoRevenue = demographics?.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const demographicSlices: DemographicSlice[] | undefined = demographics?.map((d) => ({
    segment: d.segment,
    type: d.type,
    impressions: d.impressions,
    clicks: d.clicks,
    conversions: d.conversions,
    revenue: d.revenue,
    costBRL: d.costBRL,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    cpa: d.conversions > 0 ? Math.round((d.costBRL / d.conversions) * 100) / 100 : 0,
    ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
    revenueShare: totalDemoRevenue > 0 ? Math.round((d.revenue / totalDemoRevenue) * 10000) / 100 : 0,
    sessions: d.sessions,
    users: d.users,
  }));

  // Geographic slices with derived fields
  const totalGeoRevenue = geographic?.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const geographicSlices: GeographicSlice[] | undefined = geographic?.map((d) => ({
    region: d.region,
    impressions: d.impressions,
    clicks: d.clicks,
    conversions: d.conversions,
    revenue: d.revenue,
    costBRL: d.costBRL,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    cpa: d.conversions > 0 ? Math.round((d.costBRL / d.conversions) * 100) / 100 : 0,
    ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
    revenueShare: totalGeoRevenue > 0 ? Math.round((d.revenue / totalGeoRevenue) * 10000) / 100 : 0,
    sessions: d.sessions,
    users: d.users,
  }));

  return {
    meta: { tenantId, periodStart, periodEnd, daysInPeriod, dayOfMonth, daysInMonth },
    account: accountSlice,
    skus: skuSlices,
    campaigns: campaignSlices,
    ga4: ga4Slice,
    channels: channelSlices,
    planning: planningSlice,
    devices: deviceSlices,
    demographics: demographicSlices,
    geographic: geographicSlices,
  };
}
