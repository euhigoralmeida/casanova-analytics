/* =========================
   Strategic Mode Detector
   Classifica o estado do negócio em 4 modos:
   ESCALAR / OTIMIZAR / PROTEGER / REESTRUTURAR
========================= */

import type { ModeAssessment, StrategicMode } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";

type Signal = { label: string; score: number; weight: number };

/**
 * Detecta o modo estratégico baseado em scoring ponderado.
 *
 * Score ponderado (0-100):
 *   ROAS vs meta        (peso 0.25)
 *   Pacing receita      (peso 0.25)
 *   CPA vs threshold    (peso 0.15)
 *   Margem              (peso 0.12)
 *   Composição          (peso 0.10)
 *   Tendência           (peso 0.13)
 *
 * Score ≥ 75 → ESCALAR
 * Score 50-74 → OTIMIZAR
 * Score 25-49 → PROTEGER
 * Score < 25  → REESTRUTURAR
 */
export function detectStrategicMode(cube: DataCube): ModeAssessment {
  const signals: Signal[] = [];

  // 1. ROAS vs meta (weight: 0.30)
  if (cube.account && cube.planning.roas_captado) {
    const target = cube.planning.roas_captado;
    const actual = cube.account.roas;
    const ratio = actual / target;

    let score: number;
    if (ratio >= 1.0) score = 100;
    else if (ratio >= 0.8) score = 60;
    else if (ratio >= 0.6) score = 30;
    else score = 10;

    signals.push({ label: `ROAS ${actual.toFixed(1)} vs meta ${target.toFixed(1)}`, score, weight: 0.25 });
  } else if (cube.account) {
    // Sem meta, usar threshold padrão
    const roas = cube.account.roas;
    let score: number;
    if (roas >= 8) score = 100;
    else if (roas >= 5) score = 60;
    else if (roas >= 3) score = 30;
    else score = 10;

    signals.push({ label: `ROAS ${roas.toFixed(1)} (sem meta definida)`, score, weight: 0.25 });
  }

  // 2. Pacing receita (weight: 0.25)
  if (cube.account && cube.planning.receita_captada) {
    const paceRatio = cube.meta.dayOfMonth / cube.meta.daysInMonth;
    const expected = cube.planning.receita_captada * paceRatio;
    const actual = cube.account.revenue;
    const ratio = expected > 0 ? actual / expected : 1;

    let score: number;
    if (ratio >= 1.0) score = 100;
    else if (ratio >= 0.9) score = 70;
    else if (ratio >= 0.8) score = 40;
    else score = 15;

    signals.push({ label: `Pacing receita: ${(ratio * 100).toFixed(0)}% do ritmo`, score, weight: 0.25 });
  }

  // 3. CPA (weight: 0.15)
  if (cube.account && cube.account.conversions > 0) {
    const cpa = cube.account.cpa;
    const targetCpa = cube.planning.cpa_geral ?? 80;
    const ratio = targetCpa > 0 ? cpa / targetCpa : 1;

    let score: number;
    if (ratio <= 1.0) score = 100;
    else if (ratio <= 1.2) score = 60;
    else if (ratio <= 1.5) score = 30;
    else score = 10;

    signals.push({ label: `CPA R$${cpa.toFixed(0)} vs meta R$${targetCpa.toFixed(0)}`, score, weight: 0.15 });
  }

  // 4. Margem / Eficiência de gasto (weight: 0.15)
  if (cube.account && cube.account.revenue > 0) {
    const margin = ((cube.account.revenue - cube.account.ads) / cube.account.revenue) * 100;

    let score: number;
    if (margin >= 30) score = 100;
    else if (margin >= 25) score = 70;
    else if (margin >= 20) score = 40;
    else score = 15;

    signals.push({ label: `Margem bruta: ${margin.toFixed(0)}%`, score, weight: 0.12 });
  }

  // 5. Composição / Saúde dos SKUs (weight: 0.15)
  if (cube.skus.length > 0) {
    const total = cube.skus.length;
    const escalar = cube.skus.filter((s) => s.status === "escalar").length;
    const pausar = cube.skus.filter((s) => s.status === "pausar").length;
    const healthRatio = total > 0 ? (escalar - pausar) / total : 0;

    let score: number;
    if (healthRatio > 0.3) score = 100;
    else if (healthRatio > 0.1) score = 70;
    else if (healthRatio >= 0) score = 40;
    else score = 15;

    signals.push({ label: `SKUs: ${escalar} escalar, ${pausar} pausar de ${total}`, score, weight: 0.10 });
  }

  // 6. Tendência (weight: 0.13)
  if (cube.trends?.account) {
    const trend = cube.trends.account;
    let score: number;
    if (trend.classification === "improving") score = 90;
    else if (trend.classification === "stable") score = 60;
    else score = 20;

    const arrow = trend.slopePct > 0 ? "+" : "";
    signals.push({ label: `Tendência: ${trend.classification} (${arrow}${trend.slopePct.toFixed(1)}%/dia)`, score, weight: 0.13 });
  } else {
    signals.push({ label: "Tendência: sem dados históricos", score: 60, weight: 0.13 });
  }

  // Se não temos sinais suficientes, retornar modo neutro
  if (signals.length === 0) {
    return {
      mode: "OTIMIZAR",
      confidence: 0.3,
      score: 50,
      signals: ["Dados insuficientes para classificar modo estratégico"],
      description: "Dados insuficientes — modo padrão de otimização",
    };
  }

  // Calcular score ponderado
  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const weightedScore = signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalWeight;

  // Classificar modo
  let mode: StrategicMode;
  let description: string;

  if (weightedScore >= 75) {
    mode = "ESCALAR";
    description = "Performance saudável — momento de aumentar investimento e capturar crescimento";
  } else if (weightedScore >= 50) {
    mode = "OTIMIZAR";
    description = "Performance moderada — foco em melhorar eficiência antes de escalar";
  } else if (weightedScore >= 25) {
    mode = "PROTEGER";
    description = "Performance abaixo do esperado — reduzir desperdício e proteger margem";
  } else {
    mode = "REESTRUTURAR";
    description = "Performance crítica — ação urgente necessária em múltiplas frentes";
  }

  return {
    mode,
    confidence: Math.min(0.5 + (signals.length / 5) * 0.4, 0.9),
    score: Math.round(weightedScore),
    signals: signals.map((s) => `${s.label} → score ${s.score}`),
    description,
  };
}
