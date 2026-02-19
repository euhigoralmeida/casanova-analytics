// Microsoft Clarity API client — behavioral analytics
// API: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
// Endpoint: GET https://www.clarity.ms/export-data/api/v1/project-live-insights
// Limits: 10 requests/day, max 3 days of data, 1000 rows per response
// We use 6 of 10: URL, Device, Channel, Campaign, OS, Browser
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
  // New: extracted from API response
  botSessions: number;
  distinctUsers: number;
  activeTimeRatio: number;      // activeTime / totalTime (0-1), indicates page responsiveness
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
  // New fields
  deadClickRate: number;        // sessionsWithMetricPercentage for dead clicks
  rageClickRate: number;        // sessionsWithMetricPercentage for rage clicks
  quickbacks: number;
  excessiveScrolls: number;
  impactScore: number;          // traffic × (1 - uxScore/100) — prioritizes high-traffic bad UX
};

export type ClarityDeviceBreakdown = {
  device: string;               // "PC" | "Mobile" | "Tablet"
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;
  traffic: number;
  // New fields
  quickbacks: number;
  scriptErrors: number;
  errorClicks: number;
  engagementTime: number;       // seconds (activeTime)
  botSessions: number;
  distinctUsers: number;
};

export type ClarityChannelBreakdown = {
  channel: string;
  deadClicks: number;
  deadClickRate: number;        // sessionsWithMetricPercentage
  rageClicks: number;
  rageClickRate: number;
  scrollDepth: number;
  traffic: number;
  engagementTime: number;       // seconds
  quickbacks: number;
  scriptErrors: number;
};

export type ClarityCampaignBreakdown = {
  campaign: string;
  deadClicks: number;
  deadClickRate: number;
  rageClicks: number;
  rageClickRate: number;
  traffic: number;
  engagementTime: number;       // seconds
  scriptErrors: number;
};

export type ClarityTechBreakdown = {
  name: string;
  type: "os" | "browser";
  traffic: number;
  scriptErrors: number;
  scriptErrorRate: number;      // sessionsWithMetricPercentage
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;
};

export type ClarityData = {
  source: "clarity" | "not_configured";
  numDaysCovered: number;
  behavioral: ClarityBehavioralMetrics;
  pageAnalysis: ClarityPageAnalysis[];
  deviceBreakdown: ClarityDeviceBreakdown[];
  // New breakdowns
  channelBreakdown: ClarityChannelBreakdown[];
  campaignBreakdown: ClarityCampaignBreakdown[];
  techBreakdown: ClarityTechBreakdown[];
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
   UX Score computation (rate-based)
========================= */

export function computeUxScore(page: {
  deadClickRate?: number;
  rageClickRate?: number;
  deadClicks: number;
  rageClicks: number;
  scrollDepth: number;
  engagementTime: number;
  errorClicks: number;
}): number {
  let score = 100;

  // Prefer rate-based scoring when available
  const rageRate = page.rageClickRate ?? 0;
  const deadRate = page.deadClickRate ?? 0;

  if (rageRate > 0 || deadRate > 0) {
    // Rate-based: sessionsWithMetricPercentage (%)
    if (rageRate > 15) score -= 30;
    else if (rageRate > 10) score -= 20;
    else if (rageRate > 5) score -= 10;
    else if (rageRate > 2) score -= 5;

    if (deadRate > 20) score -= 25;
    else if (deadRate > 15) score -= 15;
    else if (deadRate > 8) score -= 10;
    else if (deadRate > 3) score -= 5;
  } else {
    // Fallback: count-based (for mock data)
    if (page.rageClicks > 100) score -= 30;
    else if (page.rageClicks > 50) score -= 20;
    else if (page.rageClicks > 20) score -= 10;
    else if (page.rageClicks > 5) score -= 5;

    if (page.deadClicks > 200) score -= 25;
    else if (page.deadClicks > 100) score -= 15;
    else if (page.deadClicks > 50) score -= 10;
    else if (page.deadClicks > 20) score -= 5;
  }

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
   Impact Score computation
========================= */

export function computeImpactScore(uxScore: number, traffic: number): number {
  return Math.round((1 - uxScore / 100) * Math.log10(Math.max(traffic, 1)) * 100);
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

async function fetchClarityApi(
  numOfDays: number,
  dimension1: string,
  dimension2?: string,
  dimension3?: string,
): Promise<ClarityMetricBlock[]> {
  const token = process.env.CLARITY_API_TOKEN!;

  let url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${numOfDays}&dimension1=${dimension1}`;
  if (dimension2) url += `&dimension2=${dimension2}`;
  if (dimension3) url += `&dimension3=${dimension3}`;

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
  let totalBotSessions = 0;
  let totalDistinctUsers = 0;
  let weightedScroll = 0;
  let weightedEngagement = 0;
  let weightedPPS = 0;
  let totalTotalTime = 0;
  let totalActiveTime = 0;

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
    const botSessions = Number(trafficMap.get(url)?.totalBotSessionCount ?? 0);
    const distinctUsers = Number(trafficMap.get(url)?.distinctUserCount ?? 0);
    const pps = Number(trafficMap.get(url)?.pagesPerSessionPercentage ?? 0);
    const engagement = Number(engageMap.get(url)?.activeTime ?? 0);
    const totalTime = Number(engageMap.get(url)?.totalTime ?? 0);

    // Extract rates (sessionsWithMetricPercentage)
    const deadClickRate = Number(deadMap.get(url)?.sessionsWithMetricPercentage ?? 0);
    const rageClickRate = Number(rageMap.get(url)?.sessionsWithMetricPercentage ?? 0);

    totalDeadClicks += dead;
    totalRageClicks += rage;
    totalQuickbacks += quickback;
    totalScriptErrors += scriptErr;
    totalErrorClicks += errorC;
    totalExcessiveScrolls += excessive;
    totalTraffic += traffic;
    totalBotSessions += botSessions;
    totalDistinctUsers += distinctUsers;
    weightedScroll += scroll * traffic;
    weightedEngagement += engagement * traffic;
    weightedPPS += pps * traffic;
    totalTotalTime += totalTime;
    totalActiveTime += engagement;

    // Extract readable page title from URL
    const pageTitle = extractPageTitle(url);

    const uxScore = computeUxScore({
      deadClicks: dead,
      rageClicks: rage,
      scrollDepth: Math.round(scroll * 10) / 10,
      engagementTime: Math.round(engagement),
      errorClicks: errorC,
      deadClickRate,
      rageClickRate,
    });

    const pa: ClarityPageAnalysis = {
      url,
      pageTitle,
      deadClicks: dead,
      rageClicks: rage,
      scrollDepth: Math.round(scroll * 10) / 10,
      traffic,
      engagementTime: Math.round(engagement),
      errorClicks: errorC,
      uxScore,
      deadClickRate: Math.round(deadClickRate * 10) / 10,
      rageClickRate: Math.round(rageClickRate * 10) / 10,
      quickbacks: quickback,
      excessiveScrolls: excessive,
      impactScore: computeImpactScore(uxScore, traffic),
    };
    pages.push(pa);
  }

  // Sort by impact score descending (highest impact first)
  pages.sort((a, b) => b.impactScore - a.impactScore);

  const activeTimeRatio = totalTotalTime > 0 ? Math.round((totalActiveTime / totalTotalTime) * 100) / 100 : 0;

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
    botSessions: totalBotSessions,
    distinctUsers: totalDistinctUsers,
    activeTimeRatio,
  };

  return { pages, behavioral };
}

function parseDeviceData(blocks: ClarityMetricBlock[]): ClarityDeviceBreakdown[] {
  const dim = "Device";

  const deadMap = buildLookup(blocks, "DeadClickCount", dim);
  const rageMap = buildLookup(blocks, "RageClickCount", dim);
  const quickMap = buildLookup(blocks, "QuickbackClick", dim);
  const scriptMap = buildLookup(blocks, "ScriptErrorCount", dim);
  const errorMap = buildLookup(blocks, "ErrorClickCount", dim);
  const scrollMap = buildLookup(blocks, "ScrollDepth", dim);
  const trafficMap = buildLookup(blocks, "Traffic", dim);
  const engageMap = buildLookup(blocks, "EngagementTime", dim);

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
      quickbacks: Number(quickMap.get(device)?.subTotal ?? 0),
      scriptErrors: Number(scriptMap.get(device)?.subTotal ?? 0),
      errorClicks: Number(errorMap.get(device)?.subTotal ?? 0),
      engagementTime: Math.round(Number(engageMap.get(device)?.activeTime ?? 0)),
      botSessions: Number(trafficMap.get(device)?.totalBotSessionCount ?? 0),
      distinctUsers: Number(trafficMap.get(device)?.distinctUserCount ?? 0),
    });
  }

  // Sort by traffic descending
  result.sort((a, b) => b.traffic - a.traffic);
  return result;
}

function parseChannelData(blocks: ClarityMetricBlock[]): ClarityChannelBreakdown[] {
  const dim = "Channel";

  const deadMap = buildLookup(blocks, "DeadClickCount", dim);
  const rageMap = buildLookup(blocks, "RageClickCount", dim);
  const quickMap = buildLookup(blocks, "QuickbackClick", dim);
  const scriptMap = buildLookup(blocks, "ScriptErrorCount", dim);
  const scrollMap = buildLookup(blocks, "ScrollDepth", dim);
  const trafficMap = buildLookup(blocks, "Traffic", dim);
  const engageMap = buildLookup(blocks, "EngagementTime", dim);

  const channels = new Set<string>();
  for (const map of [deadMap, rageMap, trafficMap, scrollMap]) {
    for (const key of map.keys()) {
      if (key) channels.add(key);
    }
  }

  const result: ClarityChannelBreakdown[] = [];
  for (const channel of channels) {
    result.push({
      channel,
      deadClicks: Number(deadMap.get(channel)?.subTotal ?? 0),
      deadClickRate: Math.round(Number(deadMap.get(channel)?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      rageClicks: Number(rageMap.get(channel)?.subTotal ?? 0),
      rageClickRate: Math.round(Number(rageMap.get(channel)?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      scrollDepth: Math.round(Number(scrollMap.get(channel)?.averageScrollDepth ?? 0) * 10) / 10,
      traffic: Number(trafficMap.get(channel)?.totalSessionCount ?? 0),
      engagementTime: Math.round(Number(engageMap.get(channel)?.activeTime ?? 0)),
      quickbacks: Number(quickMap.get(channel)?.subTotal ?? 0),
      scriptErrors: Number(scriptMap.get(channel)?.subTotal ?? 0),
    });
  }

  result.sort((a, b) => b.traffic - a.traffic);
  return result;
}

function parseCampaignData(blocks: ClarityMetricBlock[]): ClarityCampaignBreakdown[] {
  const dim = "Campaign";

  const deadMap = buildLookup(blocks, "DeadClickCount", dim);
  const rageMap = buildLookup(blocks, "RageClickCount", dim);
  const scriptMap = buildLookup(blocks, "ScriptErrorCount", dim);
  const trafficMap = buildLookup(blocks, "Traffic", dim);
  const engageMap = buildLookup(blocks, "EngagementTime", dim);

  const campaigns = new Set<string>();
  for (const map of [deadMap, rageMap, trafficMap]) {
    for (const key of map.keys()) {
      if (key) campaigns.add(key);
    }
  }

  const result: ClarityCampaignBreakdown[] = [];
  for (const campaign of campaigns) {
    result.push({
      campaign,
      deadClicks: Number(deadMap.get(campaign)?.subTotal ?? 0),
      deadClickRate: Math.round(Number(deadMap.get(campaign)?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      rageClicks: Number(rageMap.get(campaign)?.subTotal ?? 0),
      rageClickRate: Math.round(Number(rageMap.get(campaign)?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      traffic: Number(trafficMap.get(campaign)?.totalSessionCount ?? 0),
      engagementTime: Math.round(Number(engageMap.get(campaign)?.activeTime ?? 0)),
      scriptErrors: Number(scriptMap.get(campaign)?.subTotal ?? 0),
    });
  }

  result.sort((a, b) => b.traffic - a.traffic);
  return result;
}

function parseTechData(blocks: ClarityMetricBlock[], type: "os" | "browser", dimKey: string): ClarityTechBreakdown[] {
  const deadMap = buildLookup(blocks, "DeadClickCount", dimKey);
  const rageMap = buildLookup(blocks, "RageClickCount", dimKey);
  const scriptMap = buildLookup(blocks, "ScriptErrorCount", dimKey);
  const scrollMap = buildLookup(blocks, "ScrollDepth", dimKey);
  const trafficMap = buildLookup(blocks, "Traffic", dimKey);

  const items = new Set<string>();
  for (const map of [deadMap, rageMap, trafficMap, scriptMap]) {
    for (const key of map.keys()) {
      if (key) items.add(key);
    }
  }

  const result: ClarityTechBreakdown[] = [];
  for (const name of items) {
    result.push({
      name,
      type,
      traffic: Number(trafficMap.get(name)?.totalSessionCount ?? 0),
      scriptErrors: Number(scriptMap.get(name)?.subTotal ?? 0),
      scriptErrorRate: Math.round(Number(scriptMap.get(name)?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      deadClicks: Number(deadMap.get(name)?.subTotal ?? 0),
      rageClicks: Number(rageMap.get(name)?.subTotal ?? 0),
      scrollDepth: Math.round(Number(scrollMap.get(name)?.averageScrollDepth ?? 0) * 10) / 10,
    });
  }

  result.sort((a, b) => b.scriptErrors - a.scriptErrors);
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

  // Check cache (use even if expired as fallback for rate limits)
  const cacheKey = getCacheKey(numOfDays);
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    // 6 parallel API calls (of 10 daily limit)
    const [urlBlocks, deviceBlocks, channelBlocks, campaignBlocks, osBlocks, browserBlocks] = await Promise.all([
      fetchClarityApi(numOfDays, "URL"),
      fetchClarityApi(numOfDays, "Device"),
      fetchClarityApi(numOfDays, "Channel"),
      fetchClarityApi(numOfDays, "Campaign"),
      fetchClarityApi(numOfDays, "OS"),
      fetchClarityApi(numOfDays, "Browser"),
    ]);

    const { pages, behavioral } = parsePageData(urlBlocks);
    const deviceBreakdown = parseDeviceData(deviceBlocks);
    const channelBreakdown = parseChannelData(channelBlocks);
    const campaignBreakdown = parseCampaignData(campaignBlocks);
    const osTech = parseTechData(osBlocks, "os", "Os");
    const browserTech = parseTechData(browserBlocks, "browser", "Browser");
    const techBreakdown = [...osTech, ...browserTech];

    const data: ClarityData = {
      source: "clarity",
      numDaysCovered: numOfDays,
      behavioral,
      pageAnalysis: pages,
      deviceBreakdown,
      channelBreakdown,
      campaignBreakdown,
      techBreakdown,
    };

    // Cache for 24h
    _cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    const errMsg = String(err);
    console.error("Clarity API error:", errMsg);

    // On rate limit (429) or any error, return expired cache if available
    if (cached) {
      console.log("Clarity: using expired cache as fallback");
      return cached.data;
    }

    // No cache available — return mock data (not empty zeros)
    console.log("Clarity: no cache available, returning mock data");
    return generateMockClarityData();
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
    botSessions: 0,
    distinctUsers: 0,
    activeTimeRatio: 0,
  };
}

function generateMockClarityData(): ClarityData {
  const pages: ClarityPageAnalysis[] = [
    { url: "/produto/27290BR-CP", pageTitle: "Casanova Pro - Produto", deadClicks: 245, rageClicks: 89, scrollDepth: 42, traffic: 1820, engagementTime: 45, errorClicks: 12, uxScore: 0, deadClickRate: 13.5, rageClickRate: 4.9, quickbacks: 15, excessiveScrolls: 8, impactScore: 0 },
    { url: "/checkout", pageTitle: "Checkout", deadClicks: 180, rageClicks: 156, scrollDepth: 65, traffic: 890, engagementTime: 120, errorClicks: 8, uxScore: 0, deadClickRate: 20.2, rageClickRate: 17.5, quickbacks: 22, excessiveScrolls: 3, impactScore: 0 },
    { url: "/carrinho", pageTitle: "Carrinho", deadClicks: 95, rageClicks: 42, scrollDepth: 78, traffic: 1240, engagementTime: 55, errorClicks: 3, uxScore: 0, deadClickRate: 7.7, rageClickRate: 3.4, quickbacks: 8, excessiveScrolls: 2, impactScore: 0 },
    { url: "/", pageTitle: "Home", deadClicks: 320, rageClicks: 28, scrollDepth: 35, traffic: 4500, engagementTime: 22, errorClicks: 1, uxScore: 0, deadClickRate: 7.1, rageClickRate: 0.6, quickbacks: 45, excessiveScrolls: 18, impactScore: 0 },
    { url: "/colecao/lancamentos", pageTitle: "Lancamentos", deadClicks: 68, rageClicks: 15, scrollDepth: 55, traffic: 980, engagementTime: 38, errorClicks: 0, uxScore: 0, deadClickRate: 6.9, rageClickRate: 1.5, quickbacks: 5, excessiveScrolls: 4, impactScore: 0 },
    { url: "/busca", pageTitle: "Busca", deadClicks: 142, rageClicks: 67, scrollDepth: 48, traffic: 760, engagementTime: 32, errorClicks: 5, uxScore: 0, deadClickRate: 18.7, rageClickRate: 8.8, quickbacks: 12, excessiveScrolls: 6, impactScore: 0 },
    { url: "/conta/pedidos", pageTitle: "Meus Pedidos", deadClicks: 35, rageClicks: 8, scrollDepth: 82, traffic: 340, engagementTime: 95, errorClicks: 0, uxScore: 0, deadClickRate: 10.3, rageClickRate: 2.4, quickbacks: 2, excessiveScrolls: 0, impactScore: 0 },
    { url: "/produto/31450BR-LX", pageTitle: "Casanova Luxo - Produto", deadClicks: 198, rageClicks: 72, scrollDepth: 38, traffic: 1560, engagementTime: 40, errorClicks: 9, uxScore: 0, deadClickRate: 12.7, rageClickRate: 4.6, quickbacks: 11, excessiveScrolls: 5, impactScore: 0 },
  ];

  for (const p of pages) {
    p.uxScore = computeUxScore(p);
    p.impactScore = computeImpactScore(p.uxScore, p.traffic);
  }
  pages.sort((a, b) => b.impactScore - a.impactScore);

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
      scriptErrors: 1030,
      errorClicks: 38,
      excessiveScrolls: 124,
      botSessions: 245,
      distinctUsers: 8750,
      activeTimeRatio: 0.42,
    },
    pageAnalysis: pages,
    deviceBreakdown: [
      { device: "Desktop", deadClicks: 520, rageClicks: 145, scrollDepth: 55.8, traffic: 5800, quickbacks: 28, scriptErrors: 380, errorClicks: 12, engagementTime: 68, botSessions: 120, distinctUsers: 4200 },
      { device: "Mobile", deadClicks: 680, rageClicks: 298, scrollDepth: 38.4, traffic: 5490, quickbacks: 52, scriptErrors: 580, errorClicks: 22, engagementTime: 38, botSessions: 95, distinctUsers: 3950 },
      { device: "Tablet", deadClicks: 83, rageClicks: 34, scrollDepth: 52.1, traffic: 800, quickbacks: 9, scriptErrors: 70, errorClicks: 4, engagementTime: 55, botSessions: 30, distinctUsers: 600 },
    ],
    channelBreakdown: [
      { channel: "Organic Search", deadClicks: 320, deadClickRate: 8.5, rageClicks: 95, rageClickRate: 2.5, scrollDepth: 52.3, traffic: 3800, engagementTime: 58, quickbacks: 25, scriptErrors: 280 },
      { channel: "Paid Search", deadClicks: 280, deadClickRate: 12.7, rageClicks: 120, rageClickRate: 5.5, scrollDepth: 44.1, traffic: 2200, engagementTime: 42, quickbacks: 22, scriptErrors: 210 },
      { channel: "Paid Shopping", deadClicks: 350, deadClickRate: 14.2, rageClicks: 155, rageClickRate: 6.3, scrollDepth: 40.8, traffic: 2500, engagementTime: 35, quickbacks: 18, scriptErrors: 320 },
      { channel: "Direct", deadClicks: 180, deadClickRate: 9.0, rageClicks: 58, rageClickRate: 2.9, scrollDepth: 55.6, traffic: 2000, engagementTime: 65, quickbacks: 12, scriptErrors: 120 },
      { channel: "Social", deadClicks: 95, deadClickRate: 15.8, rageClicks: 32, rageClickRate: 5.3, scrollDepth: 38.2, traffic: 600, engagementTime: 28, quickbacks: 8, scriptErrors: 65 },
      { channel: "Email", deadClicks: 58, deadClickRate: 5.8, rageClicks: 17, rageClickRate: 1.7, scrollDepth: 62.5, traffic: 990, engagementTime: 72, quickbacks: 4, scriptErrors: 35 },
    ],
    campaignBreakdown: [
      { campaign: "Shopping - Casanova Pro", deadClicks: 185, deadClickRate: 14.8, rageClicks: 82, rageClickRate: 6.6, traffic: 1250, engagementTime: 38, scriptErrors: 165 },
      { campaign: "Shopping - Lancamentos", deadClicks: 95, deadClickRate: 11.2, rageClicks: 45, rageClickRate: 5.3, traffic: 850, engagementTime: 42, scriptErrors: 95 },
      { campaign: "Search - Brand", deadClicks: 120, deadClickRate: 8.6, rageClicks: 38, rageClickRate: 2.7, traffic: 1400, engagementTime: 55, scriptErrors: 110 },
      { campaign: "Search - Generic", deadClicks: 160, deadClickRate: 20.0, rageClicks: 82, rageClickRate: 10.3, traffic: 800, engagementTime: 28, scriptErrors: 85 },
      { campaign: "Display - Retargeting", deadClicks: 68, deadClickRate: 17.0, rageClicks: 28, rageClickRate: 7.0, traffic: 400, engagementTime: 22, scriptErrors: 45 },
    ],
    techBreakdown: [
      { name: "iOS", type: "os", traffic: 3200, scriptErrors: 420, scriptErrorRate: 13.1, deadClicks: 380, rageClicks: 165, scrollDepth: 39.2 },
      { name: "Android", type: "os", traffic: 2800, scriptErrors: 210, scriptErrorRate: 7.5, deadClicks: 310, rageClicks: 140, scrollDepth: 42.1 },
      { name: "Windows", type: "os", traffic: 4200, scriptErrors: 280, scriptErrorRate: 6.7, deadClicks: 420, rageClicks: 118, scrollDepth: 54.8 },
      { name: "macOS", type: "os", traffic: 1500, scriptErrors: 85, scriptErrorRate: 5.7, deadClicks: 95, rageClicks: 32, scrollDepth: 58.3 },
      { name: "Chrome", type: "browser", traffic: 5800, scriptErrors: 310, scriptErrorRate: 5.3, deadClicks: 520, rageClicks: 195, scrollDepth: 48.5 },
      { name: "Safari", type: "browser", traffic: 3500, scriptErrors: 480, scriptErrorRate: 13.7, deadClicks: 410, rageClicks: 178, scrollDepth: 40.2 },
      { name: "Firefox", type: "browser", traffic: 1200, scriptErrors: 120, scriptErrorRate: 10.0, deadClicks: 145, rageClicks: 52, scrollDepth: 52.1 },
      { name: "Edge", type: "browser", traffic: 1100, scriptErrors: 80, scriptErrorRate: 7.3, deadClicks: 130, rageClicks: 38, scrollDepth: 55.4 },
      { name: "Samsung Internet", type: "browser", traffic: 490, scriptErrors: 40, scriptErrorRate: 8.2, deadClicks: 78, rageClicks: 14, scrollDepth: 41.8 },
    ],
  };
}
