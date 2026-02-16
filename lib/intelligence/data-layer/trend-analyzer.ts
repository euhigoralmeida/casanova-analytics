/* =========================
   Trend Analyzer
   Média móvel 7d, regressão linear, classificação de tendência.
   Alimentado pelo MetricSnapshot (dados históricos diários).
========================= */

import type { SnapshotMetrics } from "../snapshot";

export type TrendClassification = "improving" | "stable" | "declining";

export type TrendData = {
  classification: TrendClassification;
  slopePct: number;            // % mudança por dia (regressão linear)
  movingAvg7d: number;         // Média móvel 7 dias
  previousMovingAvg7d: number; // MA7d de 7 dias atrás
  dataPoints: number;          // Quantidade de dias históricos
};

/** Média móvel simples dos últimos N valores. */
function movingAverage(values: number[], window: number = 7): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

/**
 * Slope da regressão linear normalizado como % da média.
 * Positivo = crescendo, negativo = caindo.
 */
function linearRegressionSlopePct(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;

  const mean = values.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumXY = 0;
  let sumX2 = 0;
  const xMean = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    sumXY += (i - xMean) * (values[i] - mean);
    sumX2 += (i - xMean) * (i - xMean);
  }

  const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
  return (slope / mean) * 100;
}

/** Classifica tendência baseado em slope e comparação de MAs. */
function classify(slopePct: number, ma7d: number, prevMa7d: number): TrendClassification {
  if (slopePct > 1.5 && ma7d >= prevMa7d * 0.95) return "improving";
  if (slopePct < -1.5 && ma7d <= prevMa7d * 1.05) return "declining";
  return "stable";
}

/**
 * Analisa tendência a partir de snapshots históricos.
 * Retorna null se dados insuficientes (<3 dias).
 */
export function analyzeTrend(
  snapshots: Array<{ date: string; metrics: SnapshotMetrics }>,
  metricKey: keyof SnapshotMetrics = "revenue",
): TrendData | null {
  if (snapshots.length < 3) return null;

  const values = snapshots
    .map((s) => (s.metrics[metricKey] as number) ?? 0);

  if (values.length < 3) return null;

  const slopePct = linearRegressionSlopePct(values);
  const ma7d = movingAverage(values, 7);

  // MA7d de 7 dias antes do final da série
  const prevSlice = values.length > 7 ? values.slice(0, -7) : values.slice(0, Math.floor(values.length / 2));
  const prevMa7d = prevSlice.length > 0 ? movingAverage(prevSlice, 7) : ma7d;

  return {
    classification: classify(slopePct, ma7d, prevMa7d),
    slopePct: Math.round(slopePct * 100) / 100,
    movingAvg7d: Math.round(ma7d * 100) / 100,
    previousMovingAvg7d: Math.round(prevMa7d * 100) / 100,
    dataPoints: values.length,
  };
}

/**
 * Análise batch de tendências: account + múltiplos SKUs.
 */
export function analyzeTrends(
  accountSnapshots: Array<{ date: string; metrics: SnapshotMetrics }>,
  skuSnapshotsMap: Record<string, Array<{ date: string; metrics: SnapshotMetrics }>>,
): {
  account?: TrendData;
  skus: Record<string, TrendData>;
} {
  const account = analyzeTrend(accountSnapshots) ?? undefined;
  const skus: Record<string, TrendData> = {};

  for (const [sku, snapshots] of Object.entries(skuSnapshotsMap)) {
    const trend = analyzeTrend(snapshots);
    if (trend) skus[sku] = trend;
  }

  return { account, skus };
}
