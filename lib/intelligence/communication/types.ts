/* =========================
   Communication Layer Types
   Resposta do Motor Cognitivo + tipos de UI
========================= */

import type {
  ModeAssessment,
  Bottleneck,
  PacingProjection,
  RankedDecision,
} from "../cognitive/types";
import type { BudgetPlan } from "../strategy/budget-optimizer";
import type { TrendData } from "../data-layer/trend-analyzer";
import type { DeviceSlice, DemographicSlice, GeographicSlice } from "../data-layer/types";
import type { IntelligenceInsight, IntelligenceSummary } from "../types";

/** Dados estruturados para o Executive Summary */
export type ExecutiveSummaryData = {
  headline: string;
  topAction: string;
  keyMetrics: { label: string; value: string; status: "ok" | "warn" | "danger" }[];
};

/** Resposta completa do Motor Cognitivo */
export type CognitiveResponse = {
  // Novos campos cognitivos
  mode: ModeAssessment;
  bottleneck: Bottleneck;
  healthScore: number;
  findings: RankedDecision[];
  pacingProjections: PacingProjection[];
  executiveSummary: ExecutiveSummaryData;
  budgetPlan: BudgetPlan | null;
  accountTrend?: TrendData;
  segmentation?: {
    devices: DeviceSlice[];
    demographics: DemographicSlice[];
    geographic: GeographicSlice[];
  };

  // Campos legacy para backward compatibility
  insights: IntelligenceInsight[];
  summary: IntelligenceSummary;

  generatedAt: string;
};
