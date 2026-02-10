import { Customer } from "google-ads-api";
import { buildDateClause, getCached, setCache } from "./google-ads";

/* =========================
   Tipos internos
========================= */

export type SkuMetrics = {
  sku: string;
  title: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

/* =========================
   Query: métricas de um SKU
========================= */

export async function fetchSkuMetrics(
  customer: Customer,
  sku: string,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<SkuMetrics | null> {
  const cacheKey = startDate && endDate ? `sku:${sku}:${startDate}:${endDate}` : `sku:${sku}:${period}`;
  const cached = getCached<SkuMetrics>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.product_item_id,
      segments.product_title,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE ${dateClause}
      AND segments.product_item_id = '${sku}'
  `);

  if (!rows.length) return null;

  // Agregar múltiplas linhas (pode haver mais de uma campanha por SKU)
  const result: SkuMetrics = {
    sku,
    title: "",
    impressions: 0,
    clicks: 0,
    costBRL: 0,
    conversions: 0,
    revenue: 0,
  };

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    result.title = result.title || (r.segments?.product_title as string) || sku;
    result.impressions += (r.metrics?.impressions as number) || 0;
    result.clicks += (r.metrics?.clicks as number) || 0;
    result.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    result.conversions += (r.metrics?.conversions as number) || 0;
    result.revenue += (r.metrics?.conversions_value as number) || 0;
  }

  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: métricas de todos os SKUs
========================= */

export async function fetchAllSkuMetrics(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<SkuMetrics[]> {
  const cacheKey = startDate && endDate ? `all:${startDate}:${endDate}` : `all:${period}`;
  const cached = getCached<SkuMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.product_item_id,
      segments.product_title,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE ${dateClause}
    ORDER BY metrics.conversions_value DESC
  `);

  // Agrupar por SKU (product_item_id)
  const map = new Map<string, SkuMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const skuId = (r.segments?.product_item_id as string) || "unknown";
    const existing = map.get(skuId) ?? {
      sku: skuId,
      title: (r.segments?.product_title as string) || skuId,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(skuId, existing);
  }

  const result = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: totais da conta (campaign level)
   Captura TODOS os tipos de campanha (Shopping, Search, Display, etc.)
========================= */

export type AccountTotals = {
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

export async function fetchAccountTotals(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<AccountTotals> {
  const cacheKey = startDate && endDate ? `acct:${startDate}:${endDate}` : `acct:${period}`;
  const cached = getCached<AccountTotals>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateClause}
      AND campaign.status != 'REMOVED'
  `);

  const result: AccountTotals = {
    impressions: 0,
    clicks: 0,
    costBRL: 0,
    conversions: 0,
    revenue: 0,
  };

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    result.impressions += (r.metrics?.impressions as number) || 0;
    result.clicks += (r.metrics?.clicks as number) || 0;
    result.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    result.conversions += (r.metrics?.conversions as number) || 0;
    result.revenue += (r.metrics?.conversions_value as number) || 0;
  }

  // Arredondar para 2 casas decimais
  result.costBRL = Math.round(result.costBRL * 100) / 100;
  result.revenue = Math.round(result.revenue * 100) / 100;

  setCache(cacheKey, result);
  return result;
}

/* =========================
   Tipos: série temporal
========================= */

export type DailyMetrics = {
  date: string; // yyyy-mm-dd
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

/* =========================
   Query: série temporal de um SKU
========================= */

export async function fetchSkuTimeSeries(
  customer: Customer,
  sku: string,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DailyMetrics[]> {
  const cacheKey = startDate && endDate ? `ts:${sku}:${startDate}:${endDate}` : `ts:${sku}:${period}`;
  const cached = getCached<DailyMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE ${dateClause}
      AND segments.product_item_id = '${sku}'
    ORDER BY segments.date ASC
  `);

  // Agrupar por data (pode haver múltiplas campanhas por dia)
  const map = new Map<string, DailyMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const date = (r.segments?.date as string) || "unknown";
    const existing = map.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(date, existing);
  }

  const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: série temporal agregada (todos SKUs — shopping_performance_view)
========================= */

export async function fetchAllTimeSeries(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DailyMetrics[]> {
  const cacheKey = startDate && endDate ? `ts:all:${startDate}:${endDate}` : `ts:all:${period}`;
  const cached = getCached<DailyMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE ${dateClause}
    ORDER BY segments.date ASC
  `);

  const map = new Map<string, DailyMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const date = (r.segments?.date as string) || "unknown";
    const existing = map.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(date, existing);
  }

  const resultAll = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  setCache(cacheKey, resultAll);
  return resultAll;
}

/* =========================
   Query: série temporal a nível de conta (campaign)
   Captura TODOS os tipos de campanha (Shopping, PMax, Search, Display)
========================= */

export async function fetchAccountTimeSeries(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DailyMetrics[]> {
  const cacheKey = startDate && endDate ? `ts:acct:${startDate}:${endDate}` : `ts:acct:${period}`;
  const cached = getCached<DailyMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateClause}
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date ASC
  `);

  const map = new Map<string, DailyMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const date = (r.segments?.date as string) || "unknown";
    const existing = map.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(date, existing);
  }

  const resultAcct = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  setCache(cacheKey, resultAcct);
  return resultAcct;
}

/* =========================
   Tipos: campanhas
========================= */

export type CampaignMetrics = {
  campaignId: string;
  campaignName: string;
  channelType: string;
  status: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

/* =========================
   Enum maps (google-ads-api retorna números, não strings)
========================= */

const CHANNEL_TYPE_MAP: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "UNKNOWN",
  2: "SEARCH",
  3: "DISPLAY",
  4: "SHOPPING",
  5: "HOTEL",
  6: "VIDEO",
  7: "MULTI_CHANNEL",
  8: "LOCAL",
  9: "SMART",
  10: "PERFORMANCE_MAX",
  11: "LOCAL_SERVICES",
  12: "DISCOVERY",
  13: "TRAVEL",
  14: "DEMAND_GEN",
};

const CAMPAIGN_STATUS_MAP: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "UNKNOWN",
  2: "ENABLED",
  3: "PAUSED",
  4: "REMOVED",
};

function resolveChannelType(raw: unknown): string {
  if (typeof raw === "number") return CHANNEL_TYPE_MAP[raw] ?? "UNKNOWN";
  if (typeof raw === "string") return raw.replace("ADVERTISING_CHANNEL_TYPE_", "");
  return "UNKNOWN";
}

function resolveCampaignStatus(raw: unknown): string {
  if (typeof raw === "number") return CAMPAIGN_STATUS_MAP[raw] ?? "UNKNOWN";
  if (typeof raw === "string") return raw.replace("CAMPAIGN_STATUS_", "");
  return "UNKNOWN";
}

/* =========================
   Query: métricas por campanha
========================= */

export async function fetchAllCampaignMetrics(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<CampaignMetrics[]> {
  const cacheKey = startDate && endDate ? `camps:${startDate}:${endDate}` : `camps:${period}`;
  const cached = getCached<CampaignMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateClause}
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `);

  const result: CampaignMetrics[] = [];

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const costBRL = ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    result.push({
      campaignId: String((r.campaign?.id as number) || 0),
      campaignName: (r.campaign?.name as string) || "Sem nome",
      channelType: resolveChannelType(r.campaign?.advertising_channel_type),
      status: resolveCampaignStatus(r.campaign?.status),
      impressions: (r.metrics?.impressions as number) || 0,
      clicks: (r.metrics?.clicks as number) || 0,
      costBRL: Math.round(costBRL * 100) / 100,
      conversions: (r.metrics?.conversions as number) || 0,
      revenue: Math.round(((r.metrics?.conversions_value as number) || 0) * 100) / 100,
    });
  }

  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: série temporal de uma campanha
========================= */

export async function fetchCampaignTimeSeries(
  customer: Customer,
  campaignId: string,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DailyMetrics[]> {
  const cacheKey = startDate && endDate ? `ts:camp:${campaignId}:${startDate}:${endDate}` : `ts:camp:${campaignId}:${period}`;
  const cached = getCached<DailyMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateClause}
      AND campaign.id = ${campaignId}
    ORDER BY segments.date ASC
  `);

  const map = new Map<string, DailyMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const date = (r.segments?.date as string) || "unknown";
    const existing = map.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(date, existing);
  }

  const resultCamp = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  setCache(cacheKey, resultCamp);
  return resultCamp;
}
