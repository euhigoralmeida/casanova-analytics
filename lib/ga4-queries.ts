import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getPropertyId } from "./google-analytics";
import { getCached, setCache } from "./google-ads";

/* =========================
   Types
========================= */

export type GA4FunnelStep = {
  step: string;
  eventName: string;
  count: number;
  rate: number;
  dropoff: number;
};

export type GA4SummaryData = {
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

export type GA4DataResponse = {
  source: "ga4" | "not_configured";
  updatedAt?: string;
  funnel?: GA4FunnelStep[];
  overallConversionRate?: number;
  summary?: GA4SummaryData;
  dailySeries?: GA4DailyPoint[];
  channelAcquisition?: ChannelAcquisition[];
};

/* =========================
   GA4 Cache (shares 2-min TTL from google-ads.ts)
========================= */

function getGA4Cached<T>(key: string): T | null {
  return getCached<T>(`ga4:${key}`);
}

function setGA4Cache(key: string, data: unknown): void {
  setCache(`ga4:${key}`, data);
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
): Promise<{ funnel: GA4FunnelStep[]; overallConversionRate: number }> {
  const cacheKey = `funnel:${startDate}:${endDate}`;
  const cached = getGA4Cached<{ funnel: GA4FunnelStep[]; overallConversionRate: number }>(cacheKey);
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

  const funnel: GA4FunnelStep[] = FUNNEL_EVENTS.map((eventName, i) => {
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
): Promise<GA4SummaryData> {
  const cacheKey = `summary:${startDate}:${endDate}`;
  const cached = getGA4Cached<GA4SummaryData>(cacheKey);
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

  const result: GA4SummaryData = {
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

/* =========================
   Retention Types
========================= */

export type CohortRetentionData = {
  cohortWeek: string;
  usersStart: number;
  retention: number[];
};

export type RetentionSummary = {
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  returnRate: number;
  avgSessionsPerUser: number;
  purchases: number;
  purchasers: number;
  revenue: number;
  avgOrderValue: number;
  repurchaseEstimate: number;
};

export type ChannelLTV = {
  channel: string;
  users: number;
  purchasers: number;
  revenue: number;
  purchases: number;
  revenuePerUser: number;
  revenuePerPurchaser: number;
  purchasesPerUser: number;
  avgTicket: number;
};

export type RetentionData = {
  source: "ga4" | "not_configured";
  updatedAt?: string;
  summary: RetentionSummary;
  cohorts: CohortRetentionData[];
  channelLTV: ChannelLTV[];
};

/* =========================
   Cohort Retention Query
========================= */

export async function fetchCohortRetention(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<CohortRetentionData[]> {
  const cacheKey = `retention-cohort:${startDate}:${endDate}`;
  const cached = getGA4Cached<CohortRetentionData[]>(cacheKey);
  if (cached) return cached;

  // Build weekly cohorts spanning the date range
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const numWeeks = Math.min(12, Math.max(4, Math.floor(diffDays / 7)));

  const cohorts = [];
  for (let i = 0; i < numWeeks; i++) {
    const cohortStart = new Date(start);
    cohortStart.setDate(cohortStart.getDate() + i * 7);
    const cohortEnd = new Date(cohortStart);
    cohortEnd.setDate(cohortEnd.getDate() + 6);
    if (cohortEnd > end) break;
    const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cohorts.push({
      dimension: `week${i}`,
      dateRange: { startDate: fmtD(cohortStart), endDate: fmtD(cohortEnd) },
    });
  }

  if (cohorts.length === 0) {
    return [];
  }

  const [response] = await client.runReport({
    property: getPropertyId(),
    cohortSpec: {
      cohorts: cohorts.map((c) => ({
        name: c.dimension,
        dimension: "firstSessionDate",
        dateRange: c.dateRange,
      })),
      cohortsRange: {
        granularity: "WEEKLY" as const,
        endOffset: Math.min(8, cohorts.length),
      },
    },
    dimensions: [{ name: "cohort" }, { name: "cohortNthWeek" }],
    metrics: [{ name: "cohortActiveUsers" }, { name: "cohortTotalUsers" }],
  });

  // Parse into structured data
  const cohortMap: Record<string, { usersStart: number; weeklyUsers: Record<number, number> }> = {};

  for (const row of response.rows ?? []) {
    const cohortName = row.dimensionValues?.[0]?.value ?? "";
    const weekNum = parseInt(row.dimensionValues?.[1]?.value ?? "0", 10);
    const activeUsers = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    const totalUsers = parseInt(row.metricValues?.[1]?.value ?? "0", 10);

    if (!cohortMap[cohortName]) {
      cohortMap[cohortName] = { usersStart: 0, weeklyUsers: {} };
    }
    if (weekNum === 0) {
      cohortMap[cohortName].usersStart = totalUsers || activeUsers;
    }
    cohortMap[cohortName].weeklyUsers[weekNum] = activeUsers;
  }

  const result: CohortRetentionData[] = cohorts.map((c, i) => {
    const data = cohortMap[c.dimension];
    const usersStart = data?.usersStart ?? 0;
    const retention: number[] = [];
    const maxWeek = Math.min(8, cohorts.length);
    for (let w = 0; w <= maxWeek; w++) {
      const active = data?.weeklyUsers[w] ?? 0;
      retention.push(usersStart > 0 ? Math.round((active / usersStart) * 10000) / 100 : 0);
    }
    return {
      cohortWeek: `Semana ${i + 1}`,
      usersStart,
      retention,
    };
  });

  setGA4Cache(cacheKey, result);
  return result;
}

/* =========================
   Retention Summary Query
========================= */

export async function fetchRetentionSummary(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<RetentionSummary> {
  const cacheKey = `retention-summary:${startDate}:${endDate}`;
  const cached = getGA4Cached<RetentionSummary>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "newVsReturning" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
      { name: "totalPurchasers" },
    ],
  });

  let totalUsers = 0;
  let newUsers = 0;
  let returningUsers = 0;
  let totalSessions = 0;
  let totalPurchases = 0;
  let totalRevenue = 0;
  let totalPurchasers = 0;
  let returningPurchases = 0;
  let returningPurchasers = 0;

  for (const row of response.rows ?? []) {
    const segment = row.dimensionValues?.[0]?.value ?? "";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    const users = Math.round(vals[0] ?? 0);
    const sessions = Math.round(vals[1] ?? 0);
    const purchases = Math.round(vals[2] ?? 0);
    const revenue = Math.round((vals[3] ?? 0) * 100) / 100;
    const purchasers = Math.round(vals[4] ?? 0);

    totalUsers += users;
    totalSessions += sessions;
    totalPurchases += purchases;
    totalRevenue += revenue;
    totalPurchasers += purchasers;

    if (segment === "new") {
      newUsers = users;
    } else if (segment === "returning") {
      returningUsers = users;
      returningPurchases = purchases;
      returningPurchasers = purchasers;
    }
  }

  const result: RetentionSummary = {
    totalUsers,
    newUsers,
    returningUsers,
    returnRate: totalUsers > 0 ? Math.round((returningUsers / totalUsers) * 10000) / 100 : 0,
    avgSessionsPerUser: totalUsers > 0 ? Math.round((totalSessions / totalUsers) * 100) / 100 : 0,
    purchases: totalPurchases,
    purchasers: totalPurchasers,
    revenue: Math.round(totalRevenue * 100) / 100,
    avgOrderValue: totalPurchases > 0 ? Math.round((totalRevenue / totalPurchases) * 100) / 100 : 0,
    repurchaseEstimate: returningPurchasers > 0 ? Math.round((returningPurchases / returningPurchasers) * 100) / 100 : 0,
  };

  setGA4Cache(cacheKey, result);
  return result;
}

/* =========================
   User Lifetime Value by Channel
========================= */

export async function fetchUserLifetimeValue(
  client: BetaAnalyticsDataClient,
  startDate: string,
  endDate: string,
): Promise<ChannelLTV[]> {
  const cacheKey = `retention-ltv:${startDate}:${endDate}`;
  const cached = getGA4Cached<ChannelLTV[]>(cacheKey);
  if (cached) return cached;

  const [response] = await client.runReport({
    property: getPropertyId(),
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "firstUserDefaultChannelGroup" }],
    metrics: [
      { name: "totalUsers" },
      { name: "purchaseRevenue" },
      { name: "ecommercePurchases" },
      { name: "totalPurchasers" },
    ],
    orderBys: [{ metric: { metricName: "purchaseRevenue" }, desc: true }],
  });

  const channels: ChannelLTV[] = (response.rows ?? []).map((row) => {
    const channel = row.dimensionValues?.[0]?.value ?? "(unknown)";
    const vals = (row.metricValues ?? []).map((v) => parseFloat(v.value ?? "0"));
    const users = Math.round(vals[0] ?? 0);
    const revenue = Math.round((vals[1] ?? 0) * 100) / 100;
    const purchases = Math.round(vals[2] ?? 0);
    const purchasers = Math.round(vals[3] ?? 0);
    return {
      channel,
      users,
      purchasers,
      revenue,
      purchases,
      revenuePerUser: users > 0 ? Math.round((revenue / users) * 100) / 100 : 0,
      revenuePerPurchaser: purchasers > 0 ? Math.round((revenue / purchasers) * 100) / 100 : 0,
      purchasesPerUser: users > 0 ? Math.round((purchases / users) * 100) / 100 : 0,
      avgTicket: purchases > 0 ? Math.round((revenue / purchases) * 100) / 100 : 0,
    };
  });

  setGA4Cache(cacheKey, channels);
  return channels;
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
