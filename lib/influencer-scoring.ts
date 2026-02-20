/* =========================
   IQS — Influencer Quality Score (0-100)

   IQS = Engajamento×0.30 + Relevância×0.25 + Performance×0.20
       + QualidadeAudiência×0.15 + Conteúdo×0.10
========================= */

import type {
  InfluencerProfile,
  InfluencerEngagementMetrics,
  Collaboration,
  IQSBreakdown,
  IQSComponent,
  InfluencerTier,
} from "./influencer-types";

// ---------- Helpers ----------

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function linearScore(value: number, thresholds: [number, number, number, number]): number {
  const [excellent, good, medium, low] = thresholds;
  if (excellent > low) {
    // Higher is better
    if (value >= excellent) return 100;
    if (value >= good) return 75;
    if (value >= medium) return 50;
    return 25;
  }
  // Lower is better (inverted)
  if (value <= excellent) return 100;
  if (value <= good) return 75;
  if (value <= medium) return 50;
  return 25;
}

// ---------- Engagement Rate thresholds by tier ----------

const ER_THRESHOLDS: Record<InfluencerTier, [number, number, number, number]> = {
  nano:  [5, 3, 2, 0],
  micro: [3, 2, 1, 0],
  mid:   [2, 1.5, 1, 0],
  macro: [1.5, 1, 0.7, 0],
  mega:  [1, 0.7, 0.5, 0],
};

// ---------- 1. Engajamento (30%) ----------

function scoreEngajamento(
  profile: InfluencerProfile,
  metrics: InfluencerEngagementMetrics,
): IQSComponent {
  const erThresh = ER_THRESHOLDS[profile.tier];
  const erScore = linearScore(metrics.engagementRate, erThresh);
  const savesSharesScore = linearScore(metrics.savesSharesRatio * 100, [20, 10, 5, 0]);
  const commentLikeScore = linearScore(metrics.commentToLikeRatio * 100, [3, 2, 1, 0]);
  const responseScore = linearScore(metrics.responseRate * 100, [30, 15, 5, 0]);

  const score = erScore * 0.40 + savesSharesScore * 0.25 + commentLikeScore * 0.20 + responseScore * 0.15;

  return {
    name: "Engajamento",
    score: clamp(Math.round(score)),
    weight: 0.30,
    subMetrics: [
      { name: "Engagement Rate", value: clamp(Math.round(erScore)), weight: 0.40 },
      { name: "Saves + Shares", value: clamp(Math.round(savesSharesScore)), weight: 0.25 },
      { name: "Comment-to-Like Ratio", value: clamp(Math.round(commentLikeScore)), weight: 0.20 },
      { name: "Taxa de Resposta", value: clamp(Math.round(responseScore)), weight: 0.15 },
    ],
  };
}

// ---------- 2. Relevância do Público (25%) ----------

function scoreRelevancia(profile: InfluencerProfile): IQSComponent {
  // Geo target (default BR)
  const geoScore = profile.realFollowersPct != null
    ? linearScore(profile.realFollowersPct, [80, 60, 40, 0])
    : 50; // neutral if unknown

  // Age range — use niche relevance as proxy
  const ageScore = profile.nicheRelevanceScore != null
    ? clamp(profile.nicheRelevanceScore)
    : 50;

  // Gender — neutral if unknown
  const genderScore = 60; // default

  // Niche relevance
  const nicheScore = profile.nicheRelevanceScore != null
    ? clamp(profile.nicheRelevanceScore)
    : 50;

  const score = geoScore * 0.30 + ageScore * 0.25 + genderScore * 0.20 + nicheScore * 0.25;

  return {
    name: "Relevância",
    score: clamp(Math.round(score)),
    weight: 0.25,
    subMetrics: [
      { name: "Audiência Geo-alvo", value: clamp(Math.round(geoScore)), weight: 0.30 },
      { name: "Faixa Etária", value: clamp(Math.round(ageScore)), weight: 0.25 },
      { name: "Gênero-alvo", value: clamp(Math.round(genderScore)), weight: 0.20 },
      { name: "Nicho", value: clamp(Math.round(nicheScore)), weight: 0.25 },
    ],
  };
}

// ---------- 3. Performance Histórica (20%) ----------

function scorePerformance(
  profile: InfluencerProfile,
  metrics: InfluencerEngagementMetrics,
  collabs: Collaboration[],
): IQSComponent {
  // Consistency (ER coefficient of variation) — we use a simple proxy
  const consistency = metrics.engagementRate > 0 ? 70 : 30; // simplified

  // Growth trend 90d
  const growthScore = linearScore(profile.followersGrowthPct90d, [10, 5, 1, -999]);

  // Collab success rate (ROI > 0)
  const completedCollabs = collabs.filter((c) => c.status === "concluida");
  const successRate = completedCollabs.length > 0
    ? (completedCollabs.filter((c) => c.revenue > c.investedAmount).length / completedCollabs.length) * 100
    : 50; // neutral if no history
  const successScore = linearScore(successRate, [80, 60, 40, 0]);

  // Post frequency (posts/week) — estimate from mediaCount
  const postsPerWeek = profile.mediaCount > 0 ? Math.min(profile.mediaCount / 4, 10) : 2;
  const freqScore = postsPerWeek >= 3 && postsPerWeek <= 7
    ? 100
    : postsPerWeek >= 2 ? 75 : postsPerWeek >= 1 ? 50 : 25;

  const score = consistency * 0.30 + growthScore * 0.25 + successScore * 0.30 + freqScore * 0.15;

  return {
    name: "Performance",
    score: clamp(Math.round(score)),
    weight: 0.20,
    subMetrics: [
      { name: "Consistência ER", value: clamp(Math.round(consistency)), weight: 0.30 },
      { name: "Crescimento 90d", value: clamp(Math.round(growthScore)), weight: 0.25 },
      { name: "Taxa Sucesso Collabs", value: clamp(Math.round(successScore)), weight: 0.30 },
      { name: "Frequência Posts", value: clamp(Math.round(freqScore)), weight: 0.15 },
    ],
  };
}

// ---------- 4. Qualidade da Audiência (15%) ----------

function scoreQualidadeAudiencia(profile: InfluencerProfile): IQSComponent {
  const realPct = profile.realFollowersPct ?? 75;
  const realScore = linearScore(realPct, [85, 70, 55, 0]);

  const massPct = profile.massFollowersPct ?? 15;
  const massScore = linearScore(massPct, [10, 20, 35, 100]); // lower is better

  const suspPct = profile.suspiciousFollowersPct ?? 10;
  const suspScore = linearScore(suspPct, [5, 15, 30, 100]); // lower is better

  const ratio = profile.followingCount > 0
    ? profile.followersCount / profile.followingCount
    : 1;
  const ratioScore = linearScore(ratio, [10, 5, 2, 0]);

  const score = realScore * 0.40 + massScore * 0.20 + suspScore * 0.25 + ratioScore * 0.15;

  return {
    name: "Qualidade Audiência",
    score: clamp(Math.round(score)),
    weight: 0.15,
    subMetrics: [
      { name: "Seguidores Reais", value: clamp(Math.round(realScore)), weight: 0.40 },
      { name: "Mass Followers", value: clamp(Math.round(massScore)), weight: 0.20 },
      { name: "Seguidores Suspeitos", value: clamp(Math.round(suspScore)), weight: 0.25 },
      { name: "Ratio Followers/Following", value: clamp(Math.round(ratioScore)), weight: 0.15 },
    ],
  };
}

// ---------- 5. Conteúdo (10%) ----------

function scoreConteudo(metrics: InfluencerEngagementMetrics): IQSComponent {
  const reachScore = linearScore(metrics.reachRate * 100, [30, 20, 10, 0]);
  const videoScore = linearScore(metrics.videoCompletionRate * 100, [60, 40, 20, 0]);
  const diversityScore = metrics.formatDiversity >= 3 ? 100 : metrics.formatDiversity === 2 ? 80 : 60;

  const score = reachScore * 0.50 + videoScore * 0.25 + diversityScore * 0.25;

  return {
    name: "Conteúdo",
    score: clamp(Math.round(score)),
    weight: 0.10,
    subMetrics: [
      { name: "Reach Rate", value: clamp(Math.round(reachScore)), weight: 0.50 },
      { name: "Video Completion", value: clamp(Math.round(videoScore)), weight: 0.25 },
      { name: "Diversidade Formatos", value: clamp(Math.round(diversityScore)), weight: 0.25 },
    ],
  };
}

// ---------- Main: Calculate IQS ----------

export function calculateIQS(
  profile: InfluencerProfile,
  metrics: InfluencerEngagementMetrics,
  collabs: Collaboration[],
): { iqs: number; breakdown: IQSBreakdown } {
  const engajamento = scoreEngajamento(profile, metrics);
  const relevancia = scoreRelevancia(profile);
  const performance = scorePerformance(profile, metrics, collabs);
  const qualidadeAudiencia = scoreQualidadeAudiencia(profile);
  const conteudo = scoreConteudo(metrics);

  const iqs = Math.round(
    engajamento.score * engajamento.weight +
    relevancia.score * relevancia.weight +
    performance.score * performance.weight +
    qualidadeAudiencia.score * qualidadeAudiencia.weight +
    conteudo.score * conteudo.weight,
  );

  return {
    iqs: clamp(iqs),
    breakdown: { engajamento, relevancia, performance, qualidadeAudiencia, conteudo },
  };
}
