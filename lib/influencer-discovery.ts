/* =========================
   Influencer Discovery — Calculate metrics from business_discovery data

   Uses real data where available (engagement, likes, comments)
   and intelligent defaults for unavailable metrics (saves, shares, reach, audience).
========================= */

import type { IGDiscoveryResult, IGDiscoveryMedia } from "./instagram";
import type {
  InfluencerEngagementMetrics,
  InfluencerProfile,
  InfluencerTier,
  InfluencerLookupResponse,
  InfluencerLookupMetrics,
  InfluencerLookupPost,
} from "./influencer-types";
import { tierFromFollowers } from "./influencer-types";
import { calculateIQS } from "./influencer-scoring";

// ---------- Tier-based benchmarks ----------

const REACH_RATE_BY_TIER: Record<InfluencerTier, number> = {
  nano: 0.25,
  micro: 0.22,
  mid: 0.18,
  macro: 0.12,
  mega: 0.10,
};

// ---------- Helpers ----------

function avgField(media: IGDiscoveryMedia[], field: "likeCount" | "commentsCount"): number {
  if (media.length === 0) return 0;
  const sum = media.reduce((s, m) => s + m[field], 0);
  return Math.round((sum / media.length) * 100) / 100;
}

function countDistinctTypes(media: IGDiscoveryMedia[]): number {
  return new Set(media.map((m) => m.mediaType)).size;
}

function postsPerWeek(media: IGDiscoveryMedia[]): number {
  if (media.length < 2) return media.length;
  const timestamps = media
    .map((m) => new Date(m.timestamp).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);
  if (timestamps.length < 2) return 1;
  const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
  const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000);
  if (spanWeeks < 0.5) return timestamps.length;
  return Math.round((timestamps.length / spanWeeks) * 10) / 10;
}

// ---------- Main: Calculate discovery metrics ----------

export interface DiscoveryMetricsResult {
  metrics: InfluencerLookupMetrics;
  engagement: InfluencerEngagementMetrics;
  estimatedFields: string[];
}

export function calculateDiscoveryMetrics(discovery: IGDiscoveryResult): DiscoveryMetricsResult {
  const { profile, media } = discovery;
  const tier = tierFromFollowers(profile.followersCount);

  // Real metrics from data
  const aLikes = avgField(media, "likeCount");
  const aComments = avgField(media, "commentsCount");
  const engagementRate =
    profile.followersCount > 0
      ? Math.round(((aLikes + aComments) / profile.followersCount) * 10000) / 100
      : 0;
  const commentToLikeRatio = aLikes > 0 ? Math.round((aComments / aLikes) * 1000) / 1000 : 0;
  const formatDiversity = countDistinctTypes(media);
  const ppw = postsPerWeek(media);
  const followersFollowingRatio =
    profile.followsCount > 0
      ? Math.round((profile.followersCount / profile.followsCount) * 100) / 100
      : profile.followersCount;

  // Estimated metrics (intelligent defaults)
  const estimatedFields = [
    "savesSharesRatio",
    "responseRate",
    "reachRate",
    "videoCompletionRate",
    "realFollowersPct",
    "massFollowersPct",
    "suspiciousFollowersPct",
  ];

  const savesSharesRatio = 0.15; // 15% of likes benchmark
  const responseRate = 0.15;
  const reachRate = REACH_RATE_BY_TIER[tier];
  const videoCompletionRate = 0.40;

  const avgReach = Math.round(profile.followersCount * reachRate);
  const avgImpressions = Math.round(avgReach * 1.3); // impressions ~1.3x reach

  const lookupMetrics: InfluencerLookupMetrics = {
    engagementRate,
    avgLikes: aLikes,
    avgComments: aComments,
    commentToLikeRatio,
    formatDiversity,
    postsPerWeek: ppw,
    followersFollowingRatio,
  };

  const engagement: InfluencerEngagementMetrics = {
    engagementRate,
    avgLikes: aLikes,
    avgComments: aComments,
    avgShares: Math.round(aLikes * 0.05), // estimated
    avgSaves: Math.round(aLikes * 0.10), // estimated
    avgReach,
    avgImpressions,
    commentToLikeRatio,
    savesSharesRatio,
    responseRate,
    reachRate,
    videoCompletionRate,
    formatDiversity,
  };

  return { metrics: lookupMetrics, engagement, estimatedFields };
}

// ---------- Build full lookup response ----------

export function buildLookupResponse(discovery: IGDiscoveryResult): InfluencerLookupResponse {
  const { profile, media } = discovery;
  const tier = tierFromFollowers(profile.followersCount);
  const { metrics, engagement, estimatedFields } = calculateDiscoveryMetrics(discovery);

  // Build a minimal InfluencerProfile for IQS calculation
  const tempProfile: InfluencerProfile = {
    id: "lookup",
    tenantId: "default",
    name: profile.name ?? profile.username,
    handle: `@${profile.username}`,
    platform: "instagram",
    profilePictureUrl: profile.profilePictureUrl,
    bio: profile.biography,
    niche: "geral",
    tags: [],
    tier,
    status: "em_teste",
    followersCount: profile.followersCount,
    followingCount: profile.followsCount,
    mediaCount: profile.mediaCount,
    followersGrowthPct30d: 0,
    followersGrowthPct90d: 0,
    iqs: 0,
    iqsBreakdown: {
      engajamento: { name: "Engajamento", score: 0, weight: 0.30, subMetrics: [] },
      relevancia: { name: "Relevância", score: 0, weight: 0.25, subMetrics: [] },
      performance: { name: "Performance", score: 0, weight: 0.20, subMetrics: [] },
      qualidadeAudiencia: { name: "Qualidade Audiência", score: 0, weight: 0.15, subMetrics: [] },
      conteudo: { name: "Conteúdo", score: 0, weight: 0.10, subMetrics: [] },
    },
    totalInvested: 0,
    totalRevenue: 0,
    collaborationsCount: 0,
    realFollowersPct: 75,
    massFollowersPct: 15,
    suspiciousFollowersPct: 10,
    targetGeo: "BR",
    targetAgeRanges: ["25-34", "35-44"],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const { iqs, breakdown } = calculateIQS(tempProfile, engagement, []);

  const recentPosts: InfluencerLookupPost[] = media.map((m) => ({
    permalink: m.permalink,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    likes: m.likeCount,
    comments: m.commentsCount,
    timestamp: m.timestamp,
    caption: m.caption,
  }));

  return {
    found: true,
    profile: {
      handle: `@${profile.username}`,
      name: profile.name ?? profile.username,
      bio: profile.biography,
      profilePictureUrl: profile.profilePictureUrl,
      followersCount: profile.followersCount,
      followingCount: profile.followsCount,
      mediaCount: profile.mediaCount,
      tier,
    },
    metrics,
    iqs,
    iqsBreakdown: breakdown,
    iqsConfidence: "parcial",
    recentPosts,
    estimatedFields,
  };
}
