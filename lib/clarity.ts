// Microsoft Clarity API client — behavioral analytics
// API: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
// Endpoint: GET https://www.clarity.ms/export-data/api/v1/project-live-insights
// Limits: 10 requests/day, max 3 days of data, 1000 rows per response
// Cache: 24h TTL (separate from GA4's 2min TTL)
//
// Response format: array of { metricName, information[] }
// Metrics: DeadClickCount, RageClickCount, QuickbackClick, ScriptErrorCount,
//          ErrorClickCount, ExcessiveScroll, ScrollDepth, Traffic, EngagementTime
// Each metric has different fields in information[]:
//   - Click metrics: sessionsCount, sessionsWithMetricPercentage, pagesViews, subTotal, <dimension>
//   - ScrollDepth: averageScrollDepth, <dimension>
//   - Traffic: totalSessionCount, totalBotSessionCount, distinctUserCount, pagesPerSessionPercentage, <dimension>
//   - EngagementTime: totalTime, activeTime, <dimension>

/* =========================
   Types
========================= */

export type ClarityBehavioralMetrics = {
  deadClicks: number;
  rageClicks: number;
  avgScrollDepth: number;       // 0-100 percentage
  avgEngagementTime: number;    // seconds
  totalTraffic: number;
  pagesPerSession: number;
  quickbackClicks: number;
  scriptErrors: number;
  errorClicks: number;
  excessiveScrolls: number;
};

export type ClarityPageAnalysis = {
  url: string;
  pageTitle: string;
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;          // 0-100 percentage
  traffic: number;
  engagementTime: number;       // seconds
  errorClicks: number;
  uxScore: number;              // 0-100 computed score
};

export type ClarityDeviceBreakdown = {
  device: string;               // "PC" | "Mobile" | "Tablet"
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;
  traffic: number;
};

export type ClarityData = {
  source: "clarity" | "not_configured";
  numDaysCovered: number;
  behavioral: ClarityBehavioralMetrics;
  pageAnalysis: ClarityPageAnalysis[];
  deviceBreakdown: ClarityDeviceBreakdown[];
};

/* =========================
   Configuration
========================= */

export function isClarityConfigured(): boolean {
  return !!(process.env.CLARITY_PROJECT_ID && process.env.CLARITY_API_TOKEN);
}

export function getClarityDashboardUrl(): string {
  const projectId = process.env.CLARITY_PROJECT_ID ?? "";
  return `https://clarity.microsoft.com/projects/view/${projectId}/dashboard`;
}

/* =========================
   Cache (24h TTL)
========================= */

type CacheEntry = {
  data: ClarityData;
  expiresAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const _cache = new Map<string, CacheEntry>();

function getCacheKey(numOfDays: number): string {
  return `clarity_${numOfDays}d`;
}

/* =========================
   UX Score computation
========================= */

export function computeUxScore(page: {
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;
  engagementTime: number;
  errorClicks: number;
}): number {
  let score = 100;

  // Penalize rage clicks (heaviest — indicates frustration)
  if (page.rageClicks > 100) score -= 30;
  else if (page.rageClicks > 50) score -= 20;
  else if (page.rageClicks > 20) score -= 10;
  else if (page.rageClicks > 5) score -= 5;

  // Penalize dead clicks
  if (page.deadClicks > 200) score -= 25;
  else if (page.deadClicks > 100) score -= 15;
  else if (page.deadClicks > 50) score -= 10;
  else if (page.deadClicks > 20) score -= 5;

  // Penalize low scroll depth
  if (page.scrollDepth < 20) score -= 20;
  else if (page.scrollDepth < 40) score -= 15;
  else if (page.scrollDepth < 60) score -= 10;

  // Penalize low engagement time (< 30s is very low)
  if (page.engagementTime < 10) score -= 15;
  else if (page.engagementTime < 30) score -= 10;
  else if (page.engagementTime < 60) score -= 5;

  // Penalize error clicks
  if (page.errorClicks > 10) score -= 15;
  else if (page.errorClicks > 5) score -= 10;
  else if (page.errorClicks > 0) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/* =========================
   API types (raw response)
========================= */

type ClarityMetricBlock = {
  metricName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  information: Record<string, any>[];
};

/* =========================
   API Fetch
========================= */

async function fetchClarityApi(numOfDays: number, dimension1: string): Promise<ClarityMetricBlock[]> {
  const token = process.env.CLARITY_API_TOKEN!;

  const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${numOfDays}&dimension1=${dimension1}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Clarity API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Clarity API: unexpected response format");
  return data;
}

/* =========================
   Response parsers
========================= */

// Helper: extract metric block by name
function getMetric(blocks: ClarityMetricBlock[], name: string): ClarityMetricBlock | undefined {
  return blocks.find(b => b.metricName === name);
}

// Build a lookup map: dimension value → metric values for a given dimension key
function buildLookup(blocks: ClarityMetricBlock[], metricName: string, dimensionKey: string) {
  const metric = getMetric(blocks, metricName);
  if (!metric) return new Map<string, Record<string, unknown>>();
  const map = new Map<string, Record<string, unknown>>();
  for (const row of metric.information) {
    const key = String(row[dimensionKey] ?? "");
    if (key) map.set(key, row);
  }
  return map;
}

function parsePageData(blocks: ClarityMetricBlock[]): {
  pages: ClarityPageAnalysis[];
  behavioral: ClarityBehavioralMetrics;
} {
  const dim = "Url";

  // Build lookups per metric
  const deadMap = buildLookup(blocks, "DeadClickCount", dim);
  const rageMap = buildLookup(blocks, "RageClickCount", dim);
  const quickMap = buildLookup(blocks, "QuickbackClick", dim);
  const scriptMap = buildLookup(blocks, "ScriptErrorCount", dim);
  const errorMap = buildLookup(blocks, "ErrorClickCount", dim);
  const excessiveMap = buildLookup(blocks, "ExcessiveScroll", dim);
  const scrollMap = buildLookup(blocks, "ScrollDepth", dim);
  const trafficMap = buildLookup(blocks, "Traffic", dim);
  const engageMap = buildLookup(blocks, "EngagementTime", dim);

  // Collect all unique URLs
  const allUrls = new Set<string>();
  for (const map of [deadMap, rageMap, scrollMap, trafficMap, engageMap]) {
    for (const key of map.keys()) allUrls.add(key);
  }

  // Behavioral totals
  let totalDeadClicks = 0;
  let totalRageClicks = 0;
  let totalQuickbacks = 0;
  let totalScriptErrors = 0;
  let totalErrorClicks = 0;
  let totalExcessiveScrolls = 0;
  let totalTraffic = 0;
  let weightedScroll = 0;
  let weightedEngagement = 0;
  let weightedPPS = 0;

  const pages: ClarityPageAnalysis[] = [];

  for (const url of allUrls) {
    const dead = Number(deadMap.get(url)?.subTotal ?? 0);
    const rage = Number(rageMap.get(url)?.subTotal ?? 0);
    const quickback = Number(quickMap.get(url)?.subTotal ?? 0);
    const scriptErr = Number(scriptMap.get(url)?.subTotal ?? 0);
    const errorC = Number(errorMap.get(url)?.subTotal ?? 0);
    const excessive = Number(excessiveMap.get(url)?.subTotal ?? 0);
    const scroll = Number(scrollMap.get(url)?.averageScrollDepth ?? 0);
    const traffic = Number(trafficMap.get(url)?.totalSessionCount ?? 0);
    const pps = Number(trafficMap.get(url)?.pagesPerSessionPercentage ?? 0);
    const engagement = Number(engageMap.get(url)?.activeTime ?? 0);

    totalDeadClicks += dead;
    totalRageClicks += rage;
    totalQuickbacks += quickback;
    totalScriptErrors += scriptErr;
    totalErrorClicks += errorC;
    totalExcessiveScrolls += excessive;
    totalTraffic += traffic;
    weightedScroll += scroll * traffic;
    weightedEngagement += engagement * traffic;
    weightedPPS += pps * traffic;

    // Extract readable page title from URL
    const pageTitle = extractPageTitle(url);

    const pa: ClarityPageAnalysis = {
      url,
      pageTitle,
      deadClicks: dead,
      rageClicks: rage,
      scrollDepth: Math.round(scroll * 10) / 10,
      traffic,
      engagementTime: Math.round(engagement),
      errorClicks: errorC,
      uxScore: 0,
    };
    pa.uxScore = computeUxScore(pa);
    pages.push(pa);
  }

  // Sort by UX score ascending (worst first)
  pages.sort((a, b) => a.uxScore - b.uxScore);

  const behavioral: ClarityBehavioralMetrics = {
    deadClicks: totalDeadClicks,
    rageClicks: totalRageClicks,
    avgScrollDepth: totalTraffic > 0 ? Math.round((weightedScroll / totalTraffic) * 10) / 10 : 0,
    avgEngagementTime: totalTraffic > 0 ? Math.round(weightedEngagement / totalTraffic) : 0,
    totalTraffic,
    pagesPerSession: totalTraffic > 0 ? Math.round((weightedPPS / totalTraffic) * 10) / 10 : 0,
    quickbackClicks: totalQuickbacks,
    scriptErrors: totalScriptErrors,
    errorClicks: totalErrorClicks,
    excessiveScrolls: totalExcessiveScrolls,
  };

  return { pages, behavioral };
}

function parseDeviceData(blocks: ClarityMetricBlock[]): ClarityDeviceBreakdown[] {
  const dim = "Device";

  const deadMap = buildLookup(blocks, "DeadClickCount", dim);
  const rageMap = buildLookup(blocks, "RageClickCount", dim);
  const scrollMap = buildLookup(blocks, "ScrollDepth", dim);
  const trafficMap = buildLookup(blocks, "Traffic", dim);

  // Collect unique devices (exclude "Other" with 0 real sessions)
  const devices = new Set<string>();
  for (const map of [deadMap, trafficMap, scrollMap]) {
    for (const key of map.keys()) {
      if (key && key !== "Other") devices.add(key);
    }
  }

  const result: ClarityDeviceBreakdown[] = [];
  for (const device of devices) {
    result.push({
      device: device === "PC" ? "Desktop" : device,
      deadClicks: Number(deadMap.get(device)?.subTotal ?? 0),
      rageClicks: Number(rageMap.get(device)?.subTotal ?? 0),
      scrollDepth: Math.round(Number(scrollMap.get(device)?.averageScrollDepth ?? 0) * 10) / 10,
      traffic: Number(trafficMap.get(device)?.totalSessionCount ?? 0),
    });
  }

  // Sort by traffic descending
  result.sort((a, b) => b.traffic - a.traffic);
  return result;
}

/* =========================
   URL → Page Title helper
========================= */

function extractPageTitle(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;

    if (path === "/" || path === "") return "Home";

    // Remove query params and trailing slashes for display
    const clean = path.replace(/\/$/, "");
    const segments = clean.split("/").filter(Boolean);

    if (segments.length === 0) return "Home";

    // Try to make a human-readable title from the last segment
    const last = segments[segments.length - 1];
    return decodeURIComponent(last)
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

/* =========================
   Main fetch function
========================= */

export async function fetchClarityInsights(numOfDays = 3): Promise<ClarityData> {
  if (!isClarityConfigured()) {
    return generateMockClarityData();
  }

  // Check cache
  const cacheKey = getCacheKey(numOfDays);
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    // Two parallel API calls: pages (by URL) and devices
    const [urlBlocks, deviceBlocks] = await Promise.all([
      fetchClarityApi(numOfDays, "URL"),
      fetchClarityApi(numOfDays, "Device"),
    ]);

    const { pages, behavioral } = parsePageData(urlBlocks);
    const deviceBreakdown = parseDeviceData(deviceBlocks);

    const data: ClarityData = {
      source: "clarity",
      numDaysCovered: numOfDays,
      behavioral,
      pageAnalysis: pages,
      deviceBreakdown,
    };

    // Cache for 24h
    _cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    console.error("Clarity API error:", err);
    return {
      source: "not_configured",
      numDaysCovered: numOfDays,
      behavioral: emptyBehavioral(),
      pageAnalysis: [],
      deviceBreakdown: [],
    };
  }
}

/* =========================
   Mock data (when Clarity not configured)
========================= */

function emptyBehavioral(): ClarityBehavioralMetrics {
  return {
    deadClicks: 0,
    rageClicks: 0,
    avgScrollDepth: 0,
    avgEngagementTime: 0,
    totalTraffic: 0,
    pagesPerSession: 0,
    quickbackClicks: 0,
    scriptErrors: 0,
    errorClicks: 0,
    excessiveScrolls: 0,
  };
}

function generateMockClarityData(): ClarityData {
  const pages: ClarityPageAnalysis[] = [
    { url: "/produto/27290BR-CP", pageTitle: "Casanova Pro - Produto", deadClicks: 245, rageClicks: 89, scrollDepth: 42, traffic: 1820, engagementTime: 45, errorClicks: 12, uxScore: 0 },
    { url: "/checkout", pageTitle: "Checkout", deadClicks: 180, rageClicks: 156, scrollDepth: 65, traffic: 890, engagementTime: 120, errorClicks: 8, uxScore: 0 },
    { url: "/carrinho", pageTitle: "Carrinho", deadClicks: 95, rageClicks: 42, scrollDepth: 78, traffic: 1240, engagementTime: 55, errorClicks: 3, uxScore: 0 },
    { url: "/", pageTitle: "Home", deadClicks: 320, rageClicks: 28, scrollDepth: 35, traffic: 4500, engagementTime: 22, errorClicks: 1, uxScore: 0 },
    { url: "/colecao/lancamentos", pageTitle: "Lançamentos", deadClicks: 68, rageClicks: 15, scrollDepth: 55, traffic: 980, engagementTime: 38, errorClicks: 0, uxScore: 0 },
    { url: "/busca", pageTitle: "Busca", deadClicks: 142, rageClicks: 67, scrollDepth: 48, traffic: 760, engagementTime: 32, errorClicks: 5, uxScore: 0 },
    { url: "/conta/pedidos", pageTitle: "Meus Pedidos", deadClicks: 35, rageClicks: 8, scrollDepth: 82, traffic: 340, engagementTime: 95, errorClicks: 0, uxScore: 0 },
    { url: "/produto/31450BR-LX", pageTitle: "Casanova Luxo - Produto", deadClicks: 198, rageClicks: 72, scrollDepth: 38, traffic: 1560, engagementTime: 40, errorClicks: 9, uxScore: 0 },
  ];

  for (const p of pages) {
    p.uxScore = computeUxScore(p);
  }
  pages.sort((a, b) => a.uxScore - b.uxScore);

  return {
    source: "not_configured",
    numDaysCovered: 3,
    behavioral: {
      deadClicks: 1283,
      rageClicks: 477,
      avgScrollDepth: 48.2,
      avgEngagementTime: 52,
      totalTraffic: 12090,
      pagesPerSession: 3.2,
      quickbackClicks: 89,
      scriptErrors: 7,
      errorClicks: 38,
      excessiveScrolls: 124,
    },
    pageAnalysis: pages,
    deviceBreakdown: [
      { device: "Desktop", deadClicks: 520, rageClicks: 145, scrollDepth: 55.8, traffic: 5800 },
      { device: "Mobile", deadClicks: 680, rageClicks: 298, scrollDepth: 38.4, traffic: 5490 },
      { device: "Tablet", deadClicks: 83, rageClicks: 34, scrollDepth: 52.1, traffic: 800 },
    ],
  };
}
