/* =========================
   Cognitive Engine Types
   Tipos para findings com impacto financeiro, modo estratégico e priorização
========================= */

import type { InsightCategory, InsightSeverity, InsightSource, InsightMetrics, Recommendation } from "../types";

/** Impacto financeiro quantificado em R$ */
export type FinancialImpact = {
  /** Ganho estimado de receita se ação for executada (R$/mês) */
  estimatedRevenueGain: number;
  /** Economia estimada se ação for executada (R$/mês) */
  estimatedCostSaving: number;
  /** Impacto líquido = gain + saving (positivo = bom) */
  netImpact: number;
  /** Confiança na estimativa (0-1) */
  confidence: number;
  /** Prazo para realizar o impacto */
  timeframe: "immediate" | "short" | "medium";
  /** Fórmula legível do cálculo */
  calculation: string;
};

/** Recomendação enriquecida com impacto financeiro e prioridade */
export type EnrichedRecommendation = Recommendation & {
  financialImpact?: FinancialImpact;
  priority?: number;
};

/** Modos estratégicos do negócio */
export type StrategicMode = "ESCALAR" | "OTIMIZAR" | "PROTEGER" | "REESTRUTURAR";

/** Avaliação do modo estratégico */
export type ModeAssessment = {
  mode: StrategicMode;
  confidence: number;
  score: number;
  signals: string[];
  description: string;
};

/** Tipos de constraint/gargalo */
export type BottleneckType = "traffic" | "conversion" | "aov" | "margin" | "budget";

/** Gargalo detectado */
export type Bottleneck = {
  constraint: BottleneckType;
  severity: number; // 0-1
  explanation: string;
  financialImpact: FinancialImpact;
  unlockAction: string;
};

/** Projeção de pacing para uma métrica */
export type PacingProjection = {
  metric: string;
  label: string;
  target: number;
  currentValue: number;
  projectedEndOfMonth: number;
  projectedGap: number;
  projectedGapBRL: number;
  dailyRateNeeded: number;
  currentDailyRate: number;
  confidence: number;
  scenario: "on_track" | "at_risk" | "off_track";
};

/** Finding cognitivo — substitui IntelligenceInsight com contexto financeiro */
export type CognitiveFinding = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metrics: InsightMetrics;
  recommendations: EnrichedRecommendation[];
  source: InsightSource;
  /** Impacto financeiro quantificado — sempre presente */
  financialImpact: FinancialImpact;
  /** Causa raiz identificada pela correlation engine */
  rootCause?: string;
  /** IDs de findings relacionados */
  relatedFindingIds?: string[];
  /** ID do padrão de correlação */
  correlationId?: string;
};

/** Decisão rankeada por score de prioridade */
export type RankedDecision = {
  rank: number;
  finding: CognitiveFinding;
  score: number;
  components: {
    impactBRL: number;
    confidence: number;
    urgency: number;  // 1-3 (3 = imediato)
    effort: number;   // 1-3 (1 = fácil)
  };
};
