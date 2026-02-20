/**
 * Instagram Organic Integration — Graph API client (v21.0+)
 *
 * Fetches organic Instagram data (profile, posts, insights, audience).
 * Reuses META_ADS_ACCESS_TOKEN (same token, requires instagram_basic + instagram_manage_insights).
 *
 * API v21.0 changes:
 * - `impressions` removed → use `views` (metric_type=total_value)
 * - `engagement` removed → use `total_interactions`
 * - Daily metrics: `reach` + `follower_count` (metric_type=time_series)
 * - Totals: `views`, `total_interactions`, `follows_and_unfollows` (metric_type=total_value)
 * - Demographics: `follower_demographics` with breakdown param
 * - Media insights: `reach,saved,likes,comments,shares,total_interactions`
 */

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (IG data is delayed ~48h)
const ACCOUNT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for account discovery

// ---------- Types ----------

export type IGAccount = {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  profilePictureUrl?: string;
};

export type IGMedia = {
  id: string;
  caption?: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
};

export type IGMediaInsights = {
  mediaId: string;
  reach: number;
  saved: number;
  likes: number;
  comments: number;
  shares: number;
  totalInteractions: number;
};

export type IGDailyInsight = {
  date: string;
  reach: number;
  followerCount: number;
};

export type IGPeriodTotals = {
  views: number;
  totalInteractions: number;
  accountsEngaged: number;
  followsAndUnfollows: number;
};

export type IGAudienceGenderAge = {
  label: string; // e.g. "F.25-34", "M.18-24"
  value: number;
};

export type IGAudienceGeo = {
  name: string;
  value: number;
};

export type IGOnlineFollowers = {
  hour: number; // 0-23
  value: number;
};

export type IGInsightsResponse = {
  source: "instagram" | "not_configured" | "discovery_failed";
  updatedAt: string;
  account?: IGAccount;
  media?: IGMedia[];
  mediaInsights?: IGMediaInsights[];
  dailyInsights?: IGDailyInsight[];
  periodTotals?: IGPeriodTotals;
  audienceGenderAge?: IGAudienceGenderAge[];
  audienceCountries?: IGAudienceGeo[];
  audienceCities?: IGAudienceGeo[];
  onlineFollowers?: IGOnlineFollowers[];
};

// ---------- Config ----------

export function isInstagramConfigured(): boolean {
  return !!process.env.META_ADS_ACCESS_TOKEN;
}

function getAccessToken(): string {
  return process.env.META_ADS_ACCESS_TOKEN!;
}

// ---------- Cache ----------

const cache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string, ttl = CACHE_TTL): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------- Graph API fetch ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function graphFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("access_token", getAccessToken());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Instagram Graph API error (${res.status}):`, body);
    throw new Error(`Instagram API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ---------- Account Discovery ----------

let cachedIGAccountId: { id: string; ts: number } | null = null;

/**
 * Get the IG Business Account ID.
 * Priority: INSTAGRAM_BUSINESS_ACCOUNT_ID env var > auto-discover via /me/accounts.
 */
export async function discoverIGAccountId(): Promise<string | null> {
  // 1. Direct env var (most reliable)
  const envId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (envId) {
    return envId;
  }

  // 2. Cached result
  if (cachedIGAccountId && Date.now() - cachedIGAccountId.ts < ACCOUNT_CACHE_TTL) {
    return cachedIGAccountId.id;
  }

  // 3. Auto-discover via Pages API (requires pages_show_list permission)
  try {
    console.log("[Instagram] Attempting auto-discovery via /me/accounts...");
    const data = await graphFetch("/me/accounts", {
      fields: "instagram_business_account{id,username},name",
      limit: "100",
    });

    console.log(`[Instagram] Found ${data.data?.length ?? 0} pages`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of (data.data || []) as any[]) {
      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        console.log(`[Instagram] Found IG account ${igId} (${page.instagram_business_account.username}) on page "${page.name}"`);
        cachedIGAccountId = { id: igId, ts: Date.now() };
        return igId;
      }
    }

    console.warn("[Instagram] No Instagram Business Account found linked to any page. Set INSTAGRAM_BUSINESS_ACCOUNT_ID env var as fallback.");
    return null;
  } catch (err) {
    console.error("[Instagram] Failed to discover IG account (may need pages_show_list permission). Set INSTAGRAM_BUSINESS_ACCOUNT_ID env var instead:", err);
    return null;
  }
}

// ---------- Public API ----------

export async function fetchIGAccount(igUserId: string): Promise<IGAccount> {
  const cacheKey = `ig_account_${igUserId}`;
  const cached = getCached<IGAccount>(cacheKey);
  if (cached) return cached;

  const data = await graphFetch(`/${igUserId}`, {
    fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
  });

  const account: IGAccount = {
    id: data.id,
    username: data.username ?? "",
    name: data.name,
    biography: data.biography,
    followersCount: data.followers_count ?? 0,
    followsCount: data.follows_count ?? 0,
    mediaCount: data.media_count ?? 0,
    profilePictureUrl: data.profile_picture_url,
  };

  setCache(cacheKey, account);
  return account;
}

export async function fetchIGMedia(igUserId: string, limit = 50): Promise<IGMedia[]> {
  const cacheKey = `ig_media_${igUserId}_${limit}`;
  const cached = getCached<IGMedia[]>(cacheKey);
  if (cached) return cached;

  const data = await graphFetch(`/${igUserId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media: IGMedia[] = (data.data || []).map((m: any) => ({
    id: m.id,
    caption: m.caption,
    mediaType: m.media_type,
    mediaUrl: m.media_url,
    thumbnailUrl: m.thumbnail_url,
    permalink: m.permalink,
    timestamp: m.timestamp,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
  }));

  setCache(cacheKey, media);
  return media;
}

/**
 * Fetch per-media insights. v21.0 uses: reach, saved, likes, comments, shares, total_interactions.
 * `engagement` and `impressions` are deprecated.
 */
export async function fetchIGMediaInsights(mediaId: string): Promise<IGMediaInsights> {
  const cacheKey = `ig_media_insights_${mediaId}`;
  const cached = getCached<IGMediaInsights>(cacheKey);
  if (cached) return cached;

  const data = await graphFetch(`/${mediaId}/insights`, {
    metric: "reach,saved,likes,comments,shares,total_interactions",
  });

  const metrics: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of (data.data || []) as any[]) {
    metrics[entry.name] = entry.values?.[0]?.value ?? 0;
  }

  const insights: IGMediaInsights = {
    mediaId,
    reach: metrics.reach ?? 0,
    saved: metrics.saved ?? 0,
    likes: metrics.likes ?? 0,
    comments: metrics.comments ?? 0,
    shares: metrics.shares ?? 0,
    totalInteractions: metrics.total_interactions ?? 0,
  };

  setCache(cacheKey, insights);
  return insights;
}

/**
 * Fetch daily insights (time_series) for a date range.
 * v21.0: `reach` and `follower_count` support metric_type=time_series.
 * Chunks in 30-day windows (API limitation).
 */
export async function fetchIGDailyInsights(
  igUserId: string,
  startDate: string,
  endDate: string,
): Promise<IGDailyInsight[]> {
  const cacheKey = `ig_daily_${igUserId}_${startDate}_${endDate}`;
  const cached = getCached<IGDailyInsight[]>(cacheKey);
  if (cached) return cached;

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  // Build 30-day chunks
  const chunks: { since: number; until: number }[] = [];
  let chunkStart = new Date(start);
  while (chunkStart < end) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + 29);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({
      since: Math.floor(chunkStart.getTime() / 1000),
      until: Math.floor(chunkEnd.getTime() / 1000),
    });
    chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  const allResults = await Promise.all(
    chunks.map((chunk) =>
      graphFetch(`/${igUserId}/insights`, {
        metric: "reach,follower_count",
        period: "day",
        metric_type: "time_series",
        since: String(chunk.since),
        until: String(chunk.until),
      }).catch((err) => {
        console.warn("IG daily insights chunk error:", err);
        return { data: [] };
      }),
    ),
  );

  const dateMap = new Map<string, IGDailyInsight>();

  for (const result of allResults) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const metric of (result.data || []) as any[]) {
      const metricName = metric.name as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const point of (metric.values || []) as any[]) {
        const dateStr = (point.end_time as string).slice(0, 10);
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: dateStr, reach: 0, followerCount: 0 });
        }
        const entry = dateMap.get(dateStr)!;
        if (metricName === "reach") entry.reach = point.value ?? 0;
        if (metricName === "follower_count") entry.followerCount = point.value ?? 0;
      }
    }
  }

  const insights = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  setCache(cacheKey, insights);
  return insights;
}

/**
 * Fetch period totals (total_value metrics) for a date range.
 * v21.0: views, total_interactions, accounts_engaged, follows_and_unfollows.
 */
export async function fetchIGPeriodTotals(
  igUserId: string,
  startDate: string,
  endDate: string,
): Promise<IGPeriodTotals> {
  const cacheKey = `ig_totals_${igUserId}_${startDate}_${endDate}`;
  const cached = getCached<IGPeriodTotals>(cacheKey);
  if (cached) return cached;

  const since = Math.floor(new Date(startDate + "T00:00:00").getTime() / 1000);
  const until = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const data = await graphFetch(`/${igUserId}/insights`, {
    metric: "views,total_interactions,accounts_engaged,follows_and_unfollows",
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
  });

  const values: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const metric of (data.data || []) as any[]) {
    values[metric.name] = metric.total_value?.value ?? 0;
  }

  const totals: IGPeriodTotals = {
    views: values.views ?? 0,
    totalInteractions: values.total_interactions ?? 0,
    accountsEngaged: values.accounts_engaged ?? 0,
    followsAndUnfollows: values.follows_and_unfollows ?? 0,
  };

  setCache(cacheKey, totals);
  return totals;
}

/**
 * Fetch audience demographics using v21.0 `follower_demographics` with breakdown.
 */
export async function fetchIGAudienceDemographics(
  igUserId: string,
): Promise<{
  genderAge: IGAudienceGenderAge[];
  countries: IGAudienceGeo[];
  cities: IGAudienceGeo[];
}> {
  const cacheKey = `ig_audience_${igUserId}`;
  const cached = getCached<{ genderAge: IGAudienceGenderAge[]; countries: IGAudienceGeo[]; cities: IGAudienceGeo[] }>(cacheKey);
  if (cached) return cached;

  const [genderAgeData, countryData, cityData] = await Promise.all([
    graphFetch(`/${igUserId}/insights`, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      timeframe: "this_month",
      breakdown: "age,gender",
    }).catch(() => ({ data: [] })),
    graphFetch(`/${igUserId}/insights`, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      timeframe: "this_month",
      breakdown: "country",
    }).catch(() => ({ data: [] })),
    graphFetch(`/${igUserId}/insights`, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      timeframe: "this_month",
      breakdown: "city",
    }).catch(() => ({ data: [] })),
  ]);

  const genderAge: IGAudienceGenderAge[] = [];
  const countries: IGAudienceGeo[] = [];
  const cities: IGAudienceGeo[] = [];

  // Parse gender+age breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gaResults = genderAgeData.data?.[0]?.total_value?.breakdowns?.[0]?.results as any[] | undefined;
  if (gaResults) {
    for (const r of gaResults) {
      const age = r.dimension_values[0];
      const gender = r.dimension_values[1];
      genderAge.push({ label: `${gender}.${age}`, value: r.value });
    }
  }

  // Parse country breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryResults = countryData.data?.[0]?.total_value?.breakdowns?.[0]?.results as any[] | undefined;
  if (countryResults) {
    for (const r of countryResults) {
      countries.push({ name: r.dimension_values[0], value: r.value });
    }
  }

  // Parse city breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cityResults = cityData.data?.[0]?.total_value?.breakdowns?.[0]?.results as any[] | undefined;
  if (cityResults) {
    for (const r of cityResults) {
      cities.push({ name: r.dimension_values[0], value: r.value });
    }
  }

  // Sort by value descending
  genderAge.sort((a, b) => b.value - a.value);
  countries.sort((a, b) => b.value - a.value);
  cities.sort((a, b) => b.value - a.value);

  const result = { genderAge, countries, cities };
  setCache(cacheKey, result);
  return result;
}

// ---------- Business Discovery (fetch OTHER accounts by @handle) ----------

export type IGDiscoveryProfile = {
  username: string;
  name?: string;
  biography?: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  profilePictureUrl?: string;
};

export type IGDiscoveryMedia = {
  id: string;
  caption?: string;
  likeCount: number;
  commentsCount: number;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl?: string;
  permalink: string;
  timestamp: string;
};

export type IGDiscoveryResult = {
  profile: IGDiscoveryProfile;
  media: IGDiscoveryMedia[];
};

const DISCOVERY_CACHE_TTL = 30 * 60 * 1000; // 30 min

/**
 * Fetch another IG Business/Creator account's public data via business_discovery.
 * Requires our own IG Business Account ID as pivot.
 */
export async function fetchIGBusinessDiscovery(handle: string): Promise<IGDiscoveryResult> {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  if (!cleanHandle) throw new Error("Handle vazio");

  const cacheKey = `ig_discovery_${cleanHandle}`;
  const cached = getCached<IGDiscoveryResult>(cacheKey, DISCOVERY_CACHE_TTL);
  if (cached) return cached;

  const ownAccountId = await discoverIGAccountId();
  if (!ownAccountId) {
    throw new Error("Instagram não configurado. Configure META_ADS_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID.");
  }

  const fields = [
    "username", "name", "biography", "website",
    "followers_count", "follows_count", "media_count",
    "profile_picture_url",
    "media.limit(30){id,caption,like_count,comments_count,media_type,media_url,permalink,timestamp}",
  ].join(",");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await graphFetch(`/${ownAccountId}`, {
      fields: `business_discovery.fields(${fields}).username(${cleanHandle})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("803") || msg.includes("not found") || msg.includes("Cannot query")) {
      throw new Error("Conta não encontrada. Verifique se é uma conta Business ou Creator pública.");
    }
    throw err;
  }

  const bd = data.business_discovery;
  if (!bd) {
    throw new Error("Conta não encontrada. Verifique se é uma conta Business ou Creator pública.");
  }

  const profile: IGDiscoveryProfile = {
    username: bd.username ?? cleanHandle,
    name: bd.name,
    biography: bd.biography,
    followersCount: bd.followers_count ?? 0,
    followsCount: bd.follows_count ?? 0,
    mediaCount: bd.media_count ?? 0,
    profilePictureUrl: bd.profile_picture_url,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media: IGDiscoveryMedia[] = (bd.media?.data || []).map((m: any) => ({
    id: m.id,
    caption: m.caption,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
    mediaType: m.media_type ?? "IMAGE",
    mediaUrl: m.media_url,
    permalink: m.permalink ?? "",
    timestamp: m.timestamp ?? "",
  }));

  const result: IGDiscoveryResult = { profile, media };
  setCache(cacheKey, result);
  return result;
}

/**
 * Fetch online followers by hour (lifetime snapshot).
 */
export async function fetchIGOnlineFollowers(igUserId: string): Promise<IGOnlineFollowers[]> {
  const cacheKey = `ig_online_${igUserId}`;
  const cached = getCached<IGOnlineFollowers[]>(cacheKey);
  if (cached) return cached;

  const data = await graphFetch(`/${igUserId}/insights`, {
    metric: "online_followers",
    period: "lifetime",
  });

  const online: IGOnlineFollowers[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const metric of (data.data || []) as any[]) {
    if (metric.name === "online_followers") {
      const values = metric.values?.[0]?.value;
      if (values && typeof values === "object") {
        for (const [hour, value] of Object.entries(values)) {
          online.push({ hour: parseInt(hour), value: value as number });
        }
      }
    }
  }

  online.sort((a, b) => a.hour - b.hour);

  setCache(cacheKey, online);
  return online;
}
