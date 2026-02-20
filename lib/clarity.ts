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
  source: "clarity" | "not_configured" | "rate_limited";
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
   Cache (24h TTL) — file-based for persistence across restarts/cold starts
========================= */

import * as fs from "fs";
import * as path from "path";

type CacheEntry = {
  data: ClarityData;
  expiresAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const _memCache = new Map<string, CacheEntry>();

// File-based cache dir: /tmp on Vercel, .cache locally
const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".cache");

function getCacheKey(numOfDays: number): string {
  return `clarity_${numOfDays}d`;
}

function getCacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readFileCache(key: string): CacheEntry | null {
  try {
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeFileCache(key: string, entry: CacheEntry): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(getCacheFilePath(key), JSON.stringify(entry));
  } catch (err) {
    console.error("Clarity cache write error:", err);
  }
}

function getCache(key: string): CacheEntry | null {
  // Memory first, then file
  const mem = _memCache.get(key);
  if (mem) return mem;
  const file = readFileCache(key);
  if (file) {
    _memCache.set(key, file); // hydrate memory
    return file;
  }
  return null;
}

function setCache(key: string, entry: CacheEntry): void {
  _memCache.set(key, entry);
  writeFileCache(key, entry);
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
    return {
      source: "not_configured",
      numDaysCovered: numOfDays,
      behavioral: emptyBehavioral(),
      pageAnalysis: [],
      deviceBreakdown: [],
      channelBreakdown: [],
      campaignBreakdown: [],
      techBreakdown: [],
    };
  }

  // Check cache (use even if expired as fallback for rate limits)
  const cacheKey = getCacheKey(numOfDays);
  const cached = getCache(cacheKey);
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

    // Cache for 24h (file + memory)
    setCache(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    const errMsg = String(err);
    const isRateLimit = errMsg.includes("429");
    console.error("Clarity API error:", errMsg);

    // On rate limit (429) or any error, return expired cache if available
    if (cached) {
      console.log("Clarity: using expired cache as fallback");
      return cached.data;
    }

    // No cache available — return informative source
    console.log(`Clarity: no cache available, ${isRateLimit ? "rate limited" : "error"}`);
    return {
      source: isRateLimit ? "rate_limited" : "not_configured",
      numDaysCovered: numOfDays,
      behavioral: emptyBehavioral(),
      pageAnalysis: [],
      deviceBreakdown: [],
      channelBreakdown: [],
      campaignBreakdown: [],
      techBreakdown: [],
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
    botSessions: 0,
    distinctUsers: 0,
    activeTimeRatio: 0,
  };
}

