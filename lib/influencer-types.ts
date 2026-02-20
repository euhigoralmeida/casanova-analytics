/* =========================
   Tipos do módulo Influenciadores
========================= */

import type { KpiStatus } from "@/types/api";

// ---------- Enums / constants ----------

export const INFLUENCER_TIERS = ["nano", "micro", "mid", "macro", "mega"] as const;
export type InfluencerTier = (typeof INFLUENCER_TIERS)[number];

export const INFLUENCER_STATUSES = ["ativo", "em_teste", "pausado", "blacklist"] as const;
export type InfluencerStatus = (typeof INFLUENCER_STATUSES)[number];

export const INFLUENCER_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type InfluencerPlatform = (typeof INFLUENCER_PLATFORMS)[number];

export const COLLAB_TYPES = [
  "post_feed", "stories", "reels", "live", "cupom", "afiliado", "embaixador", "permuta",
] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];

export const COLLAB_STATUSES = ["planejada", "em_andamento", "concluida", "cancelada"] as const;
export type CollabStatus = (typeof COLLAB_STATUSES)[number];

// ---------- Tier helpers ----------

export function tierFromFollowers(count: number): InfluencerTier {
  if (count >= 1_000_000) return "mega";
  if (count >= 500_000) return "macro";
  if (count >= 100_000) return "mid";
  if (count >= 10_000) return "micro";
  return "nano";
}

export function tierLabel(tier: InfluencerTier): string {
  const labels: Record<InfluencerTier, string> = {
    nano: "Nano (<10k)",
    micro: "Micro (10k-100k)",
    mid: "Mid (100k-500k)",
    macro: "Macro (500k-1M)",
    mega: "Mega (>1M)",
  };
  return labels[tier];
}

// ---------- IQS Breakdown ----------

export interface IQSSubMetric {
  name: string;
  value: number;  // 0-100
  weight: number; // 0-1
}

export interface IQSComponent {
  name: string;
  score: number;  // 0-100
  weight: number; // 0-1
  subMetrics: IQSSubMetric[];
}

export interface IQSBreakdown {
  engajamento: IQSComponent;    // 30%
  relevancia: IQSComponent;     // 25%
  performance: IQSComponent;    // 20%
  qualidadeAudiencia: IQSComponent; // 15%
  conteudo: IQSComponent;       // 10%
}

export function iqsStatus(score: number): KpiStatus {
  if (score >= 60) return "ok";
  if (score >= 40) return "warn";
  return "danger";
}

export function iqsLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Médio";
  return "Baixo";
}

// ---------- Engagement Metrics ----------

export interface InfluencerEngagementMetrics {
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgSaves: number;
  avgReach: number;
  avgImpressions: number;
  commentToLikeRatio: number;
  savesSharesRatio: number;
  responseRate: number;
  reachRate: number;
  videoCompletionRate: number;
  formatDiversity: number; // count of distinct formats used
}

// ---------- Profile ----------

export interface InfluencerProfile {
  id: string;
  tenantId: string;
  name: string;
  handle: string;
  platform: InfluencerPlatform;
  profilePictureUrl?: string;
  bio?: string;
  niche: string;
  tags: string[];
  location?: string;
  tier: InfluencerTier;
  status: InfluencerStatus;

  followersCount: number;
  followingCount: number;
  mediaCount: number;
  followersGrowthPct30d: number;
  followersGrowthPct90d: number;

  igAccountId?: string;

  iqs: number;
  iqsBreakdown: IQSBreakdown;
  iqsUpdatedAt?: string;

  totalInvested: number;
  totalRevenue: number;
  collaborationsCount: number;

  // Audience quality
  realFollowersPct?: number;
  massFollowersPct?: number;
  suspiciousFollowersPct?: number;
  nicheRelevanceScore?: number;

  // Target audience config
  targetGeo: string;
  targetAgeRanges: string[];
  targetGender?: string;

  updatedAt: string;
  createdAt: string;
}

// ---------- Collaboration ----------

export interface Collaboration {
  id: string;
  tenantId: string;
  influencerId: string;
  title: string;
  type: CollabType;
  status: CollabStatus;
  startDate: string;
  endDate?: string;
  investedAmount: number;
  couponCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  postUrls: string[];
  briefDescription?: string;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes?: string;
  updatedAt: string;
  createdAt: string;
}

// ---------- ROI Estimate ----------

export interface ROIEstimate {
  estimatedReach: number;
  estimatedEngagement: number;
  estimatedClicks: number;
  estimatedConversions: number;
  estimatedRevenue: number;
  estimatedROI: number;
  confidenceLevel: "alta" | "media" | "baixa";
  basedOnCollabs: number;
}

// ---------- Recommendation ----------

export type RecommendationAction = "escalar" | "testar" | "manter" | "pausar" | "reativar";
export type RecommendationPriority = "alta" | "media" | "baixa";

export interface InfluencerRecommendation {
  influencerId: string;
  influencerName: string;
  action: RecommendationAction;
  priority: RecommendationPriority;
  reason: string;
  expectedImpact: string;
  suggestedBudget?: number;
}

// ---------- Budget Allocation ----------

export interface BudgetAllocation {
  influencerId: string;
  influencerName: string;
  iqs: number;
  historicalROI: number;
  currentAllocation: number;
  suggestedAllocation: number;
  expectedROI: number;
}

// ---------- Lookup / Discovery ----------

export interface InfluencerLookupProfile {
  handle: string;
  name: string;
  bio?: string;
  profilePictureUrl?: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  tier: InfluencerTier;
}

export interface InfluencerLookupMetrics {
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  commentToLikeRatio: number;
  formatDiversity: number;
  postsPerWeek: number;
  followersFollowingRatio: number;
}

export interface InfluencerLookupPost {
  permalink: string;
  mediaType: string;
  mediaUrl?: string;
  likes: number;
  comments: number;
  timestamp: string;
  caption?: string;
}

export interface InfluencerLookupResponse {
  found: true;
  profile: InfluencerLookupProfile;
  metrics: InfluencerLookupMetrics;
  iqs: number;
  iqsBreakdown: IQSBreakdown;
  iqsConfidence: "parcial";
  recentPosts: InfluencerLookupPost[];
  estimatedFields: string[];
}

// ---------- API Responses ----------

export interface InfluencerDashboardResponse {
  kpis: {
    total: number;
    avgIqs: number;
    avgIqsStatus: KpiStatus;
    totalInvested: number;
    totalRevenue: number;
    avgROI: number;
  };
  iqsDistribution: { range: string; count: number; pct: number }[];
  influencers: InfluencerProfile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InfluencerDetailResponse {
  profile: InfluencerProfile;
  engagement: InfluencerEngagementMetrics;
  engagementHistory: { date: string; engagementRate: number }[];
  engagementByType: { type: string; rate: number; count: number }[];
  collaborations: Collaboration[];
  roiEstimate: ROIEstimate;
  audience?: {
    genderAge: { label: string; value: number }[];
    cities: { name: string; pct: number }[];
    countries: { name: string; pct: number }[];
  };
}

export interface InfluencerComparisonResponse {
  profiles: InfluencerProfile[];
  benchmarks: {
    avgIqs: number;
    avgEngRate: number;
    avgROI: number;
    avgRealFollowersPct: number;
  };
  recommendation: string;
}

export interface InfluencerAdvisorResponse {
  totalBudget: number;
  allocations: BudgetAllocation[];
  recommendations: InfluencerRecommendation[];
  insights: { title: string; description: string; severity: "success" | "warning" | "danger" }[];
}
