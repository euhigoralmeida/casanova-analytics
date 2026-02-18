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
  campaignStatus: "ENABLED" | "PAUSED";
};

/** Data de corte para status: último dia do range -1 (produtos ativos = impressões no(s) último(s) dia(s)) */
function statusCutoffDate(rangeEnd?: string): string {
  const base = rangeEnd ? new Date(rangeEnd + "T12:00:00") : new Date();
  base.setDate(base.getDate() - 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

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

  // Query única com campaign.status e date para detectar status ativo
  const rows = await customer.query(`
    SELECT
      segments.product_item_id,
      segments.product_title,
      segments.date,
      campaign.status,
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

  // Cutoff: último dia do range para determinar status atual
  const cutoffStr = statusCutoffDate(endDate);
  let isRecentEnabled = false;

  const result: SkuMetrics = {
    sku,
    title: "",
    impressions: 0,
    clicks: 0,
    costBRL: 0,
    conversions: 0,
    revenue: 0,
    campaignStatus: "PAUSED",
  };

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const rowDate = (r.segments?.date as string) || "";
    const campStatus = resolveCampaignStatus(r.campaign?.status);

    if (rowDate >= cutoffStr && campStatus === "ENABLED") {
      isRecentEnabled = true;
    }

    result.title = result.title || (r.segments?.product_title as string) || sku;
    result.impressions += (r.metrics?.impressions as number) || 0;
    result.clicks += (r.metrics?.clicks as number) || 0;
    result.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    result.conversions += (r.metrics?.conversions as number) || 0;
    result.revenue += (r.metrics?.conversions_value as number) || 0;
  }

  result.campaignStatus = isRecentEnabled ? "ENABLED" : "PAUSED";

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

  // Query única com campaign.status e date para detectar status ativo na mesma query
  const rows = await customer.query(`
    SELECT
      segments.product_item_id,
      segments.product_title,
      segments.date,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE ${dateClause}
    ORDER BY metrics.conversions_value DESC
  `);

  // Cutoff: último dia do range para determinar status atual do produto
  const cutoffStr = statusCutoffDate(endDate);
  const recentEnabled = new Set<string>();

  // Agrupar por SKU (product_item_id)
  const map = new Map<string, SkuMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const skuId = (r.segments?.product_item_id as string) || "unknown";
    const rowDate = (r.segments?.date as string) || "";
    const campStatus = resolveCampaignStatus(r.campaign?.status);

    // Rastrear SKUs com atividade recente em campanhas ativas
    if (rowDate >= cutoffStr && campStatus === "ENABLED") {
      recentEnabled.add(skuId);
    }

    const existing = map.get(skuId) ?? {
      sku: skuId,
      title: (r.segments?.product_title as string) || skuId,
      impressions: 0,
      clicks: 0,
      costBRL: 0,
      conversions: 0,
      revenue: 0,
      campaignStatus: "PAUSED" as const, // será definido após o loop
    };

    existing.impressions += (r.metrics?.impressions as number) || 0;
    existing.clicks += (r.metrics?.clicks as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as number) || 0;

    map.set(skuId, existing);
  }

  // Definir status baseado em atividade recente
  for (const [skuId, entry] of map) {
    entry.campaignStatus = recentEnabled.has(skuId) ? "ENABLED" : "PAUSED";
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

/* =========================
   Tipos: device / demographic / geographic
========================= */

export type DeviceMetrics = {
  device: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

export type DemographicMetrics = {
  segment: string;
  type: "age" | "gender";
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

export type GeographicMetrics = {
  region: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
};

/* =========================
   Enum maps: device
========================= */

const DEVICE_MAP: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "UNKNOWN",
  2: "MOBILE",
  3: "TABLET",
  4: "DESKTOP",
  5: "CONNECTED_TV",
  6: "OTHER",
};

function resolveDevice(raw: unknown): string {
  if (typeof raw === "number") return DEVICE_MAP[raw] ?? "UNKNOWN";
  if (typeof raw === "string") return raw;
  return "UNKNOWN";
}

/* =========================
   Enum maps: gender
========================= */

const GENDER_MAP: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "UNKNOWN",
  10: "MALE",
  11: "FEMALE",
  20: "UNDETERMINED",
};

function resolveGender(raw: unknown): string {
  if (typeof raw === "number") return GENDER_MAP[raw] ?? "UNDETERMINED";
  if (typeof raw === "string") {
    if (raw === "MALE" || raw === "FEMALE" || raw === "UNDETERMINED") return raw;
    const n = parseInt(raw, 10);
    if (!isNaN(n) && GENDER_MAP[n]) return GENDER_MAP[n];
    return raw;
  }
  return "UNDETERMINED";
}

/* =========================
   Enum maps: age range
========================= */

const AGE_RANGE_MAP: Record<number, string> = {
  0: "AGE_RANGE_UNDETERMINED",
  1: "AGE_RANGE_UNDETERMINED",
  503001: "AGE_RANGE_18_24",
  503002: "AGE_RANGE_25_34",
  503003: "AGE_RANGE_35_44",
  503004: "AGE_RANGE_45_54",
  503005: "AGE_RANGE_55_64",
  503006: "AGE_RANGE_65_UP",
  503999: "AGE_RANGE_UNDETERMINED",
  // Alternative enum values (v14+)
  2: "AGE_RANGE_18_24",
  3: "AGE_RANGE_25_34",
  4: "AGE_RANGE_35_44",
  5: "AGE_RANGE_45_54",
  6: "AGE_RANGE_55_64",
  7: "AGE_RANGE_65_UP",
};

function resolveAgeRange(raw: unknown): string {
  if (typeof raw === "number") return AGE_RANGE_MAP[raw] ?? "AGE_RANGE_UNDETERMINED";
  if (typeof raw === "string") {
    // Already a valid string enum
    if (raw.startsWith("AGE_RANGE_")) return raw;
    // Try parsing as number
    const n = parseInt(raw, 10);
    if (!isNaN(n) && AGE_RANGE_MAP[n]) return AGE_RANGE_MAP[n];
    return raw;
  }
  return "AGE_RANGE_UNDETERMINED";
}

/* =========================
   Query: métricas por dispositivo
========================= */

export async function fetchDeviceMetrics(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DeviceMetrics[]> {
  const cacheKey = startDate && endDate ? `dev:${startDate}:${endDate}` : `dev:${period}`;
  const cached = getCached<DeviceMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateClause}
      AND campaign.status = 'ENABLED'
  `);

  const map = new Map<string, DeviceMetrics>();

  for (const row of rows) {
    const r = row as Record<string, Record<string, unknown>>;
    const device = resolveDevice(r.segments?.device);
    const existing = map.get(device) ?? {
      device,
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

    map.set(device, existing);
  }

  const result = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: métricas demográficas (age_range_view + gender_view)
========================= */

export async function fetchDemographicMetrics(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DemographicMetrics[]> {
  const cacheKey = startDate && endDate ? `demo:${startDate}:${endDate}` : `demo:${period}`;
  const cached = getCached<DemographicMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const [ageRows, genderRows] = await Promise.all([
    customer.query(`
      SELECT
        ad_group_criterion.age_range.type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM age_range_view
      WHERE ${dateClause}
    `),
    customer.query(`
      SELECT
        ad_group_criterion.gender.type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM gender_view
      WHERE ${dateClause}
    `),
  ]);

  const result: DemographicMetrics[] = [];

  // Aggregate age rows by segment
  const ageMap = new Map<string, DemographicMetrics>();
  for (const row of ageRows) {
    const r = row as Record<string, Record<string, Record<string, unknown>>>;
    const segment = resolveAgeRange(r.ad_group_criterion?.age_range?.type);
    const existing = ageMap.get(segment) ?? {
      segment,
      type: "age" as const,
      impressions: 0, clicks: 0, costBRL: 0, conversions: 0, revenue: 0,
    };
    existing.impressions += (r.metrics?.impressions as unknown as number) || 0;
    existing.clicks += (r.metrics?.clicks as unknown as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as unknown as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as unknown as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as unknown as number) || 0;
    ageMap.set(segment, existing);
  }
  result.push(...ageMap.values());

  // Aggregate gender rows by segment
  const genderMap = new Map<string, DemographicMetrics>();
  for (const row of genderRows) {
    const r = row as Record<string, Record<string, Record<string, unknown>>>;
    const segment = resolveGender(r.ad_group_criterion?.gender?.type);
    const existing = genderMap.get(segment) ?? {
      segment,
      type: "gender" as const,
      impressions: 0, clicks: 0, costBRL: 0, conversions: 0, revenue: 0,
    };
    existing.impressions += (r.metrics?.impressions as unknown as number) || 0;
    existing.clicks += (r.metrics?.clicks as unknown as number) || 0;
    existing.costBRL += ((r.metrics?.cost_micros as unknown as number) || 0) / 1_000_000;
    existing.conversions += (r.metrics?.conversions as unknown as number) || 0;
    existing.revenue += (r.metrics?.conversions_value as unknown as number) || 0;
    genderMap.set(segment, existing);
  }
  result.push(...genderMap.values());

  setCache(cacheKey, result);
  return result;
}

/* =========================
   Query: métricas geográficas
========================= */

export async function fetchGeographicMetrics(
  customer: Customer,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<GeographicMetrics[]> {
  const cacheKey = startDate && endDate ? `geo:${startDate}:${endDate}` : `geo:${period}`;
  const cached = getCached<GeographicMetrics[]>(cacheKey);
  if (cached) return cached;

  const dateClause = buildDateClause(period, startDate, endDate);

  const rows = await customer.query(`
    SELECT
      segments.geo_target_region,
      geo_target_constant.name,
      geo_target_constant.canonical_name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM geographic_view
    WHERE ${dateClause}
      AND geographic_view.location_type = 'LOCATION_OF_PRESENCE'
  `);

  const map = new Map<string, GeographicMetrics>();

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    // Prefer geo_target_constant.name, fall back to canonical_name, then resource name
    const rawRegion = String(r.segments?.geo_target_region ?? "Desconhecido");
    const geoName = r.geo_target_constant?.name ?? r.geo_target_constant?.canonical_name ?? null;
    const region = geoName ? String(geoName) : rawRegion.replace(/^geoTargetConstants\//, "Região ");
    const existing = map.get(region) ?? {
      region,
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

    map.set(region, existing);
  }

  const result = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
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
