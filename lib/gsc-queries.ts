import { getGSCClientAsync, getSiteUrl } from "./google-search-console";
import type { GSCKeywordRow, GSCPageRow, GSCDailyPoint } from "./organic-types";

/* =========================
   GSC Cache (30 min TTL — dados GSC tem delay de 2-3 dias)
========================= */

const GSC_TTL = 30 * 60 * 1000; // 30 minutos
const gscCache = new Map<string, { data: unknown; ts: number }>();

function getGSCCached<T>(key: string): T | null {
  const entry = gscCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > GSC_TTL) {
    gscCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setGSCCache(key: string, data: unknown): void {
  gscCache.set(key, { data, ts: Date.now() });
}

/* =========================
   Date adjustment (GSC data has 2-3 day delay)
========================= */

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function adjustGSCEndDate(endDate: string): string {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() - 3);
  const requested = new Date(endDate + "T12:00:00");
  return requested > maxDate ? fmtDate(maxDate) : endDate;
}

/* =========================
   Query: keywords (query dimension)
========================= */

export async function fetchKeywordMetrics(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<GSCKeywordRow[]> {
  const adjEnd = adjustGSCEndDate(endDate);
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:gsc:kw:${startDate}:${adjEnd}`;
  const cached = getGSCCached<GSCKeywordRow[]>(cacheKey);
  if (cached) return cached;

  const client = await getGSCClientAsync(tenantId);
  if (!client) return [];
  const siteUrl = getSiteUrl(tenantId);
  if (!siteUrl) return [];

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate: adjEnd,
      dimensions: ["query"],
      rowLimit: 5000,
      type: "web",
    },
  });

  const rows: GSCKeywordRow[] = (response.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  setGSCCache(cacheKey, rows);
  return rows;
}

/* =========================
   Query: pages (page dimension)
========================= */

export async function fetchPageMetrics(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<GSCPageRow[]> {
  const adjEnd = adjustGSCEndDate(endDate);
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:gsc:pages:${startDate}:${adjEnd}`;
  const cached = getGSCCached<GSCPageRow[]>(cacheKey);
  if (cached) return cached;

  const client = await getGSCClientAsync(tenantId);
  if (!client) return [];
  const siteUrl = getSiteUrl(tenantId);
  if (!siteUrl) return [];

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate: adjEnd,
      dimensions: ["page"],
      rowLimit: 5000,
      type: "web",
    },
  });

  const rows: GSCPageRow[] = (response.data.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  setGSCCache(cacheKey, rows);
  return rows;
}

/* =========================
   Query: daily organic trend
========================= */

export async function fetchDailyOrganicTrend(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<GSCDailyPoint[]> {
  const adjEnd = adjustGSCEndDate(endDate);
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:gsc:daily:${startDate}:${adjEnd}`;
  const cached = getGSCCached<GSCDailyPoint[]>(cacheKey);
  if (cached) return cached;

  const client = await getGSCClientAsync(tenantId);
  if (!client) return [];
  const siteUrl = getSiteUrl(tenantId);
  if (!siteUrl) return [];

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate: adjEnd,
      dimensions: ["date"],
      type: "web",
    },
  });

  const rows: GSCDailyPoint[] = (response.data.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  rows.sort((a, b) => a.date.localeCompare(b.date));
  setGSCCache(cacheKey, rows);
  return rows;
}

/* =========================
   Query: keywords by specific page
========================= */

export async function fetchKeywordsByPage(
  page: string,
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<GSCKeywordRow[]> {
  const adjEnd = adjustGSCEndDate(endDate);
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:gsc:kwp:${page}:${startDate}:${adjEnd}`;
  const cached = getGSCCached<GSCKeywordRow[]>(cacheKey);
  if (cached) return cached;

  const client = await getGSCClientAsync(tenantId);
  if (!client) return [];
  const siteUrl = getSiteUrl(tenantId);
  if (!siteUrl) return [];

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate: adjEnd,
      dimensions: ["query"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "equals",
              expression: page,
            },
          ],
        },
      ],
      rowLimit: 500,
      type: "web",
    },
  });

  const rows: GSCKeywordRow[] = (response.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  setGSCCache(cacheKey, rows);
  return rows;
}

/* =========================
   Query: keywords with delta (compare 2 periods)
========================= */

export async function fetchKeywordsWithDelta(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  tenantId?: string,
): Promise<(GSCKeywordRow & { deltaPosition: number; deltaClicks: number })[]> {
  const [current, previous] = await Promise.all([
    fetchKeywordMetrics(startDate, endDate, tenantId),
    fetchKeywordMetrics(prevStartDate, prevEndDate, tenantId),
  ]);

  const prevMap = new Map(previous.map((r) => [r.query, r]));

  return current.map((row) => {
    const prev = prevMap.get(row.query);
    return {
      ...row,
      deltaPosition: prev ? Math.round((prev.position - row.position) * 10) / 10 : 0,
      deltaClicks: prev ? row.clicks - prev.clicks : 0,
    };
  });
}
