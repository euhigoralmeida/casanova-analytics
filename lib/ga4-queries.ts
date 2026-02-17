import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getPropertyId } from "./google-analytics";
import { getCached, setCache } from "./google-ads";

/* =========================
   Types
========================= */

export type FunnelStep = {
  step: string;
  eventName: string;
  count: number;
  rate: number;
  dropoff: number;
};

export type GA4Summary = {
  sessions: number;
  engagedSessions: number;
  bounceRate: number;
  users: number;
  newUsers: number;
  purchases: number;
  purchaseRevenue: number;
  avgOrderValue: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
};

export type GA4DailyPoint = {
  date: string;
  sessions: number;
  pageViews: number;
  viewItems: number;
  addToCarts: number;
  checkouts: number;
  shippingInfos: number;
  paymentInfos: number;
  purchases: number;
  purchaseRevenue: number;
};

export type ChannelAcquisition = {
  channel: string;
  users: number;
  newUsers: number;
  sessions: number;
  conversions: number;
  revenue: number;
};

export type GA4Response = {
  source: "ga4" | "not_configured";
  updatedAt?: string;
  funnel?: FunnelStep[];
  overallConversionRate?: number;
  summary?: GA4Summary;
  dailySeries?: GA4DailyPoint[];
  channelAcquisition?: ChannelAcquisition[];
};

/* =========================
   GA4 Cache (5 min TTL)
========================= */

const GA4_TTL = 5 * 60 * 1000;

function getGA4Cached<T>(key: string): T | null {
  return getCached<T>(`ga4:${key}`);
}

function setGA4Cache(key: string, data: unknown): void {
  // Override the default 2-min cache with 5-min for GA4
  const entry = { data, ts: Date.now() };
  // Use the same cache map but with custom key prefix
  setCache(`ga4:${key}`, data);
  // Note: relies on the 2-min TTL from google-ads.ts, but GA4 data changes less frequently
  void entry;
  void GA4_TTL;
}

/* =========================
   Funnel Query
========================= */

const FUNNEL_EVENTS = ["page_view", "view_item", "add_to_cart", "begin_checkout", "add_shipping_info", "add_payment_info", "purchase"];
const FUNNEL_LABELS: Record<string, string> = {
  page_view: "Page View",
  view_item: "View Content",
  add_to_cart: "Add to Cart",
  begin_checkout: "Initiate Checkout",
  add_shipping_info: "Shipping Info",
  add_payment_info: "Payment Info",
  purchase: "Purchase",
};

export async function fetchEcommerceFunnel(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<{ funnel: FunnelStep[]; overallConversionRate: number }> {
  const cacheKey = `funnel:${startDate}:${endDate}`;
  const cached = getGA4Cached<{ funnel: FunnelStep[]; overallConversionRate: number }>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: FUNNEL_EVENTS,
        },
      },
    },
  });

  const eventCounts: Record<string, number> = {};
  for (const row of response.rows ?? []) {
    const eventName = row.dimensionValues?.[0]?.value ?? "";
    const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    eventCounts[eventName] = count;
  }

  const funnel: FunnelStep[] = FUNNEL_EVENTS.map((eventName, i) => {
    const count = eventCounts[eventName] ?? 0;
    const prevCount = i > 0 ? (eventCounts[FUNNEL_EVENTS[i - 1]] ?? 0) : count;
    const rate = prevCount > 0 ? Math.round((count / prevCount) * 10000) / 100 : 0;
    const dropoff = prevCount > 0 ? Math.max(0, Math.round(((prevCount - count) / prevCount) * 10000) / 100) : 0;

    return {
      step: FUNNEL_LABELS[eventName],
      eventName,
      count,
      rate: i === 0 ? 100 : rate,
      dropoff: i === 0 ? 0 : dropoff,
    };
  });

  const pageViews = eventCounts["page_view"] ?? 0;
  const purchases = eventCounts["purchase"] ?? 0;
  const overallConversionRate = pageViews > 0 ? Math.round((purchases / pageViews) * 10000) / 100 : 0;

  const result = { funnel, overallConversionRate };
  setGA4Cache(cacheKey, result);
  return result;
}

/* =========================
   Summary Query
========================= */

export async function fetchGA4Summary(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4Summary> {
  const cacheKey = `summary:${startDate}:${endDate}`;
  const cached = getGA4Cached<GA4Summary>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
      { name: "addToCarts" },
      { name: "checkouts" },
      { name: "engagedSessions" },
      { name: "bounceRate" },
    ],
  });

  const row = response.rows?.[0];
  const vals = (row?.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));

  const sessions = vals[0] ?? 0;
  const users = vals[1] ?? 0;
  const newUsers = vals[2] ?? 0;
  const purchases = vals[3] ?? 0;
  const purchaseRevenue = Math.round((vals[4] ?? 0) * 100) / 100;
  const addToCarts = vals[5] ?? 0;
  const checkouts = vals[6] ?? 0;
  const engagedSessions = Math.round(vals[7] ?? 0);
  const bounceRate = Math.round((vals[8] ?? 0) * 100) / 100;

  const avgOrderValue = purchases > 0 ? Math.round((purchaseRevenue / purchases) * 100) / 100 : 0;
  const cartAbandonmentRate = addToCarts > 0 ? Math.round(((addToCarts - purchases) / addToCarts) * 10000) / 100 : 0;
  const checkoutAbandonmentRate = checkouts > 0 ? Math.round(((checkouts - purchases) / checkouts) * 10000) / 100 : 0;

  const result: GA4Summary = {
    sessions,
    engagedSessions,
    bounceRate,
    users,
    newUsers,
    purchases,
    purchaseRevenue,
    avgOrderValue,
    cartAbandonmentRate,
    checkoutAbandonmentRate,
  };

  setGA4Cache(cacheKey, result);
  return result;
}

/* =========================
   Daily Time Series
========================= */

const TIMESERIES_EVENTS = ["page_view", "view_item", "add_to_cart", "begin_checkout", "add_shipping_info", "add_payment_info", "purchase"];

export async function fetchGA4FunnelTimeSeries(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4DailyPoint[]> {
  const cacheKey = `ts:${startDate}:${endDate}`;
  const cached = getGA4Cached<GA4DailyPoint[]>(cacheKey);
  if (cached) return cached;

  // Query 1: sessions + revenue by date
  const [sessionsRes] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  // Query 2: event counts by date + eventName for funnel events
  const [eventsRes] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: TIMESERIES_EVENTS },
      },
    },
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  // Build sessions/revenue map by date
  const dateMap: Record<string, GA4DailyPoint> = {};
  for (const row of sessionsRes.rows ?? []) {
    const dateRaw = row.dimensionValues?.[0]?.value ?? "";
    const date = dateRaw.length === 8
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      : dateRaw;
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    dateMap[date] = {
      date,
      sessions: vals[0] ?? 0,
      pageViews: 0,
      viewItems: 0,
      addToCarts: 0,
      checkouts: 0,
      shippingInfos: 0,
      paymentInfos: 0,
      purchases: 0,
      purchaseRevenue: Math.round((vals[1] ?? 0) * 100) / 100,
    };
  }

  // Fill event counts
  for (const row of eventsRes.rows ?? []) {
    const dateRaw = row.dimensionValues?.[0]?.value ?? "";
    const date = dateRaw.length === 8
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      : dateRaw;
    const eventName = row.dimensionValues?.[1]?.value ?? "";
    const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);

    if (!dateMap[date]) {
      dateMap[date] = { date, sessions: 0, pageViews: 0, viewItems: 0, addToCarts: 0, checkouts: 0, shippingInfos: 0, paymentInfos: 0, purchases: 0, purchaseRevenue: 0 };
    }

    const point = dateMap[date];
    if (eventName === "page_view") point.pageViews = count;
    else if (eventName === "view_item") point.viewItems = count;
    else if (eventName === "add_to_cart") point.addToCarts = count;
    else if (eventName === "begin_checkout") point.checkouts = count;
    else if (eventName === "add_shipping_info") point.shippingInfos = count;
    else if (eventName === "add_payment_info") point.paymentInfos = count;
    else if (eventName === "purchase") point.purchases = count;
  }

  const series = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  setGA4Cache(cacheKey, series);
  return series;
}

/* =========================
   Channel Acquisition Query
========================= */

/* =========================
   Demographics: Age + Gender
========================= */

export type GA4DemographicRow = {
  segment: string;
  type: "age" | "gender";
  users: number;
  sessions: number;
  conversions: number;
  revenue: number;
};

const GA4_GENDER_LABELS: Record<string, string> = {
  male: "MALE",
  female: "FEMALE",
  unknown: "UNDETERMINED",
};

const GA4_AGE_LABELS: Record<string, string> = {
  "18-24": "AGE_RANGE_18_24",
  "25-34": "AGE_RANGE_25_34",
  "35-44": "AGE_RANGE_35_44",
  "45-54": "AGE_RANGE_45_54",
  "55-64": "AGE_RANGE_55_64",
  "65+": "AGE_RANGE_65_UP",
  unknown: "AGE_RANGE_UNDETERMINED",
};

export async function fetchGA4Demographics(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4DemographicRow[]> {
  const cacheKey = `ga4demo:${startDate}:${endDate}`;
  const cached = getGA4Cached<GA4DemographicRow[]>(cacheKey);
  if (cached) return cached;

  const [ageRes, genderRes] = await Promise.all([
    client.runReport({
      property: getPropertyId(),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "userAgeBracket" }],
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "ecommercePurchases" },
        { name: "purchaseRevenue" },
      ],
    }),
    client.runReport({
      property: getPropertyId(),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "userGender" }],
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "ecommercePurchases" },
        { name: "purchaseRevenue" },
      ],
    }),
  ]);

  const result: GA4DemographicRow[] = [];

  for (const row of ageRes[0].rows ?? []) {
    const rawAge = row.dimensionValues?.[0]?.value ?? "unknown";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    result.push({
      segment: GA4_AGE_LABELS[rawAge] ?? rawAge,
      type: "age",
      users: Math.round(vals[0] ?? 0),
      sessions: Math.round(vals[1] ?? 0),
      conversions: Math.round(vals[2] ?? 0),
      revenue: Math.round((vals[3] ?? 0) * 100) / 100,
    });
  }

  for (const row of genderRes[0].rows ?? []) {
    const rawGender = row.dimensionValues?.[0]?.value ?? "unknown";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    result.push({
      segment: GA4_GENDER_LABELS[rawGender] ?? rawGender,
      type: "gender",
      users: Math.round(vals[0] ?? 0),
      sessions: Math.round(vals[1] ?? 0),
      conversions: Math.round(vals[2] ?? 0),
      revenue: Math.round((vals[3] ?? 0) * 100) / 100,
    });
  }

  setGA4Cache(cacheKey, result);
  return result;
}

/* =========================
   Geographic: Region
========================= */

export type GA4GeographicRow = {
  region: string;
  users: number;
  sessions: number;
  conversions: number;
  revenue: number;
};

export async function fetchGA4Geographic(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<GA4GeographicRow[]> {
  const cacheKey = `ga4geo:${startDate}:${endDate}`;
  const cached = getGA4Cached<GA4GeographicRow[]>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "region" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ metric: { metricName: "purchaseRevenue" }, desc: true }],
    limit: 20,
  });

  const rows: GA4GeographicRow[] = (response.rows ?? []).map((row) => {
    const region = row.dimensionValues?.[0]?.value ?? "(desconhecido)";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    return {
      region: region === "(not set)" ? "Não definido" : region,
      users: Math.round(vals[0] ?? 0),
      sessions: Math.round(vals[1] ?? 0),
      conversions: Math.round(vals[2] ?? 0),
      revenue: Math.round((vals[3] ?? 0) * 100) / 100,
    };
  });

  setGA4Cache(cacheKey, rows);
  return rows;
}

/* =========================
   Channel Acquisition Query
========================= */

export async function fetchChannelAcquisition(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<ChannelAcquisition[]> {
  const cacheKey = `channels:${startDate}:${endDate}`;
  const cached = getGA4Cached<ChannelAcquisition[]>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "firstUserDefaultChannelGroup" }],
    metrics: [
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
  });

  const channels: ChannelAcquisition[] = (response.rows ?? []).map((row) => {
    const channel = row.dimensionValues?.[0]?.value ?? "(unknown)";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    return {
      channel,
      users: Math.round(vals[0] ?? 0),
      newUsers: Math.round(vals[1] ?? 0),
      sessions: Math.round(vals[2] ?? 0),
      conversions: Math.round(vals[3] ?? 0),
      revenue: Math.round((vals[4] ?? 0) * 100) / 100,
    };
  });

  setGA4Cache(cacheKey, channels);
  return channels;
}
