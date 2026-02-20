/**
 * Instagram Organic Integration — Graph API client
 *
 * Fetches organic Instagram data (profile, posts, insights, audience).
 * Reuses META_ADS_ACCESS_TOKEN (same token, requires instagram_basic + instagram_manage_insights).
 * Auto-discovers the IG Business Account ID via the Pages API.
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
  impressions: number;
  reach: number;
  engagement: number;
  saved: number;
};

export type IGDailyInsight = {
  date: string;
  impressions: number;
  reach: number;
  followerCount: number;
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
  source: "instagram" | "not_configured";
  updatedAt: string;
  account?: IGAccount;
  media?: IGMedia[];
  mediaInsights?: IGMediaInsights[];
  dailyInsights?: IGDailyInsight[];
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

export async function discoverIGAccountId(): Promise<string | null> {
  if (cachedIGAccountId && Date.now() - cachedIGAccountId.ts < ACCOUNT_CACHE_TTL) {
    return cachedIGAccountId.id;
  }

  try {
    const data = await graphFetch("/me/accounts", {
      fields: "instagram_business_account{id,username}",
      limit: "100",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of (data.data || []) as any[]) {
      if (page.instagram_business_account?.id) {
        cachedIGAccountId = { id: page.instagram_business_account.id, ts: Date.now() };
        return page.instagram_business_account.id;
      }
    }

    console.warn("No Instagram Business Account found linked to any page.");
    return null;
  } catch (err) {
    console.error("Failed to discover IG account:", err);
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

export async function fetchIGMediaInsights(mediaId: string): Promise<IGMediaInsights> {
  const cacheKey = `ig_media_insights_${mediaId}`;
  const cached = getCached<IGMediaInsights>(cacheKey);
  if (cached) return cached;

  const data = await graphFetch(`/${mediaId}/insights`, {
    metric: "impressions,reach,engagement,saved",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of (data.data || []) as any[]) {
    metrics[entry.name] = entry.values?.[0]?.value ?? 0;
  }

  const insights: IGMediaInsights = {
    mediaId,
    impressions: metrics.impressions ?? 0,
    reach: metrics.reach ?? 0,
    engagement: metrics.engagement ?? 0,
    saved: metrics.saved ?? 0,
  };

  setCache(cacheKey, insights);
  return insights;
}

/**
 * Fetch daily insights for a date range.
 * The IG Insights API limits to 30-day windows, so we chunk accordingly.
 * `since`/`until` must be Unix timestamps.
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
        metric: "impressions,reach,follower_count",
        period: "day",
        since: String(chunk.since),
        until: String(chunk.until),
      }).catch((err) => {
        console.warn("IG daily insights chunk error:", err);
        return { data: [] };
      }),
    ),
  );

  // Parse: each metric has its own entry with values array
  const dateMap = new Map<string, IGDailyInsight>();

  for (const result of allResults) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const metric of (result.data || []) as any[]) {
      const metricName = metric.name as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const point of (metric.values || []) as any[]) {
        const dateStr = (point.end_time as string).slice(0, 10);
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: dateStr, impressions: 0, reach: 0, followerCount: 0 });
        }
        const entry = dateMap.get(dateStr)!;
        if (metricName === "impressions") entry.impressions = point.value ?? 0;
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
 * Fetch audience demographics (lifetime snapshot — no date range).
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

  const data = await graphFetch(`/${igUserId}/insights`, {
    metric: "audience_gender_age,audience_country,audience_city",
    period: "lifetime",
  });

  const genderAge: IGAudienceGenderAge[] = [];
  const countries: IGAudienceGeo[] = [];
  const cities: IGAudienceGeo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const metric of (data.data || []) as any[]) {
    const values = metric.values?.[0]?.value;
    if (!values || typeof values !== "object") continue;

    if (metric.name === "audience_gender_age") {
      for (const [label, value] of Object.entries(values)) {
        genderAge.push({ label, value: value as number });
      }
    } else if (metric.name === "audience_country") {
      for (const [name, value] of Object.entries(values)) {
        countries.push({ name, value: value as number });
      }
    } else if (metric.name === "audience_city") {
      for (const [name, value] of Object.entries(values)) {
        cities.push({ name, value: value as number });
      }
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

/**
 * Fetch online followers by hour (lifetime snapshot — no date range).
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
