/**
 * Meta Ads Integration — Real Graph API client
 *
 * Uses fetch against the Meta Marketing API (Graph API).
 * Env vars: META_ADS_ACCESS_TOKEN, META_ADS_ACCOUNT_ID
 */

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// ---------- Types ----------

export type MetaAdsCampaign = {
  campaignId: string;
  campaignName: string;
  objective: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  cpc: number;
  ctr: number;
  cpm: number;
};

export type MetaAccountTotals = {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  cpc: number;
  ctr: number;
};

export type MetaTimeSeriesPoint = {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number;
};

export type MetaAdsResponse = {
  source: "meta-ads" | "not_configured";
  updatedAt: string;
  campaigns: MetaAdsCampaign[];
  accountTotals?: MetaAccountTotals;
  timeSeries?: MetaTimeSeriesPoint[];
};

// ---------- Config ----------

export function isMetaAdsConfigured(): boolean {
  return !!(
    process.env.META_ADS_ACCESS_TOKEN &&
    process.env.META_ADS_ACCOUNT_ID
  );
}

function getAccountId(): string {
  return process.env.META_ADS_ACCOUNT_ID!;
}

function getAccessToken(): string {
  return process.env.META_ADS_ACCESS_TOKEN!;
}

// ---------- Cache ----------

const cache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------- Graph API fetch ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function graphFetch(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("access_token", getAccessToken());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Meta Graph API error (${res.status}):`, body);
    throw new Error(`Meta API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ---------- Parsing helpers ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseConversions(actions: any[] | undefined): number {
  if (!actions) return 0;
  let total = 0;
  for (const a of actions) {
    if (a.action_type === "purchase" || a.action_type === "omni_purchase") {
      total += parseFloat(a.value) || 0;
    }
  }
  return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRevenue(actionValues: any[] | undefined): number {
  if (!actionValues) return 0;
  for (const a of actionValues) {
    if (a.action_type === "omni_purchase" || a.action_type === "purchase") {
      return parseFloat(a.value) || 0;
    }
  }
  return 0;
}

// ---------- Public API ----------

const CAMPAIGN_FIELDS = "campaign_id,campaign_name,objective,impressions,clicks,spend,actions,action_values,cpm,cpc,ctr";
const ACCOUNT_FIELDS = "impressions,clicks,spend,actions,action_values,cpm,cpc,ctr";

export async function fetchMetaCampaigns(startDate: string, endDate: string): Promise<MetaAdsCampaign[]> {
  const cacheKey = `meta_campaigns_${startDate}_${endDate}`;
  const cached = getCached<MetaAdsCampaign[]>(cacheKey);
  if (cached) return cached;

  const actId = getAccountId();
  const timeRange = JSON.stringify({ since: startDate, until: endDate });

  // Fetch campaign-level insights
  const data = await graphFetch(`/act_${actId}/insights`, {
    level: "campaign",
    fields: CAMPAIGN_FIELDS,
    time_range: timeRange,
    limit: "500",
  });

  // Also fetch campaign statuses
  const campaignStatusData = await graphFetch(`/act_${actId}/campaigns`, {
    fields: "id,name,status,objective",
    limit: "500",
  }).catch(() => ({ data: [] }));

  // Build status lookup
  const statusMap = new Map<string, string>();
  if (campaignStatusData?.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of campaignStatusData.data as any[]) {
      statusMap.set(c.id, c.status);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaigns: MetaAdsCampaign[] = (data.data || []).map((row: any) => {
    const impressions = parseInt(row.impressions) || 0;
    const clicks = parseInt(row.clicks) || 0;
    const spend = parseFloat(row.spend) || 0;
    const conversions = parseConversions(row.actions);
    const revenue = parseRevenue(row.action_values);
    const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0;
    const cpa = conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0;
    const cpc = clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const cpm = impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0;

    const campaignId = row.campaign_id;
    const rawStatus = statusMap.get(campaignId) ?? "ACTIVE";

    return {
      campaignId,
      campaignName: row.campaign_name ?? "Sem nome",
      objective: row.objective ?? "",
      status: rawStatus,
      impressions,
      clicks,
      spend,
      conversions: Math.round(conversions * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      roas,
      cpa,
      cpc,
      ctr,
      cpm,
    };
  });

  setCache(cacheKey, campaigns);
  return campaigns;
}

export async function fetchMetaAccountTotals(startDate: string, endDate: string): Promise<MetaAccountTotals> {
  const cacheKey = `meta_account_${startDate}_${endDate}`;
  const cached = getCached<MetaAccountTotals>(cacheKey);
  if (cached) return cached;

  const actId = getAccountId();
  const timeRange = JSON.stringify({ since: startDate, until: endDate });

  const data = await graphFetch(`/act_${actId}/insights`, {
    fields: ACCOUNT_FIELDS,
    time_range: timeRange,
  });

  const row = data.data?.[0];
  if (!row) {
    const empty: MetaAccountTotals = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0, roas: 0, cpa: 0, cpc: 0, ctr: 0 };
    setCache(cacheKey, empty);
    return empty;
  }

  const impressions = parseInt(row.impressions) || 0;
  const clicks = parseInt(row.clicks) || 0;
  const spend = parseFloat(row.spend) || 0;
  const conversions = parseConversions(row.actions);
  const revenue = parseRevenue(row.action_values);

  const totals: MetaAccountTotals = {
    impressions,
    clicks,
    spend: Math.round(spend * 100) / 100,
    conversions: Math.round(conversions * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
    cpa: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
    cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
  };

  setCache(cacheKey, totals);
  return totals;
}

export async function fetchMetaTimeSeries(startDate: string, endDate: string): Promise<MetaTimeSeriesPoint[]> {
  const cacheKey = `meta_timeseries_${startDate}_${endDate}`;
  const cached = getCached<MetaTimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const actId = getAccountId();
  const timeRange = JSON.stringify({ since: startDate, until: endDate });

  const data = await graphFetch(`/act_${actId}/insights`, {
    fields: ACCOUNT_FIELDS,
    time_range: timeRange,
    time_increment: "1",
    limit: "500",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: MetaTimeSeriesPoint[] = (data.data || []).map((row: any) => {
    const spend = parseFloat(row.spend) || 0;
    const conversions = parseConversions(row.actions);
    const revenue = parseRevenue(row.action_values);

    return {
      date: row.date_start,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: Math.round(spend * 100) / 100,
      conversions: Math.round(conversions * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
    };
  });

  setCache(cacheKey, series);
  return series;
}
