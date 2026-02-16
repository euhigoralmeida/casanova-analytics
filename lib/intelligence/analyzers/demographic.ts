/* =========================
   Analyzer: Demografia
   Faixas etárias + gênero — qual público converte melhor
========================= */

import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube, DemographicSlice } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import { quantifyWastedSpend, quantifyUnderinvestment, quantifyBudgetReallocation } from "../cognitive/financial-impact";

const AGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: "18-24",
  AGE_RANGE_25_34: "25-34",
  AGE_RANGE_35_44: "35-44",
  AGE_RANGE_45_54: "45-54",
  AGE_RANGE_55_64: "55-64",
  AGE_RANGE_65_UP: "65+",
  AGE_RANGE_UNDETERMINED: "Não determinado",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  UNDETERMINED: "Não determinado",
};

function label(slice: DemographicSlice): string {
  if (slice.type === "age") return AGE_LABELS[slice.segment] ?? slice.segment;
  return GENDER_LABELS[slice.segment] ?? slice.segment;
}

export function analyzeDemographics(_ctx: AnalysisContext, cube: DataCube): CognitiveFinding[] {
  const findings: CognitiveFinding[] = [];
  if (!cube.demographics || cube.demographics.length === 0) return findings;

  const ageSlices = cube.demographics.filter((d) => d.type === "age" && d.segment !== "AGE_RANGE_UNDETERMINED");
  const genderSlices = cube.demographics.filter((d) => d.type === "gender" && d.segment !== "UNDETERMINED");

  // 1. Faixa etária com CPA > 2x da média
  if (ageSlices.length >= 2) {
    const withSpend = ageSlices.filter((a) => a.costBRL > 50);
    if (withSpend.length >= 2) {
      const avgCpa = withSpend.reduce((s, a) => s + a.cpa, 0) / withSpend.length;
      const highCpa = withSpend.filter((a) => a.cpa > avgCpa * 2 && a.conversions > 0);

      if (highCpa.length > 0) {
        const worst = highCpa.sort((a, b) => b.cpa - a.cpa)[0];
        const excessPct = (worst.cpa - avgCpa) / worst.cpa;
        const wastedAmount = worst.costBRL * excessPct;

        findings.push({
          id: "demo-age-high-cpa",
          category: "efficiency",
          severity: "warning",
          title: `Faixa ${label(worst)} com CPA de ${formatBRL(worst.cpa)} (média: ${formatBRL(avgCpa)})`,
          description: `Faixa etária ${label(worst)} tem CPA ${(worst.cpa / avgCpa).toFixed(1)}x acima da média. Considere reduzir investimento neste público.`,
          metrics: { current: worst.cpa, target: avgCpa, entityName: label(worst) },
          recommendations: [{
            action: `Reduzir bid para faixa ${label(worst)} em 30-50%`,
            impact: "medium",
            effort: "low",
            steps: [
              `Ajustar bid modifier de idade ${label(worst)} para -40%`,
              "Monitorar CPA por 7 dias",
            ],
          }],
          source: "pattern",
          financialImpact: quantifyWastedSpend(wastedAmount),
        });
      }
    }
  }

  // 2. Faixa etária com melhor ROAS e share < 30% (oportunidade)
  if (ageSlices.length >= 2) {
    const withConv = ageSlices.filter((a) => a.conversions > 0 && a.costBRL > 50);
    if (withConv.length >= 2) {
      const best = withConv.sort((a, b) => b.roas - a.roas)[0];
      const avgSpend = withConv.reduce((s, a) => s + a.costBRL, 0) / withConv.length;

      if (best.roas > 7 && best.revenueShare < 30) {
        findings.push({
          id: "demo-age-best",
          category: "opportunity",
          severity: "success",
          title: `Faixa ${label(best)} tem ROAS ${best.roas.toFixed(1)} com apenas ${best.revenueShare.toFixed(0)}% da receita`,
          description: `Melhor público por retorno. Aumentar investimento nesta faixa pode gerar receita incremental.`,
          metrics: { current: best.revenueShare, target: 30, entityName: label(best) },
          recommendations: [{
            action: `Aumentar bid para faixa ${label(best)} em 20-30%`,
            impact: "high",
            effort: "low",
          }],
          source: "pattern",
          financialImpact: quantifyUnderinvestment(best.costBRL, avgSpend, best.roas),
        });
      }
    }
  }

  // 3. Diferença de ROAS > 50% entre gêneros
  if (genderSlices.length >= 2) {
    const withConv = genderSlices.filter((g) => g.conversions > 0 && g.costBRL > 100);
    if (withConv.length >= 2) {
      const sorted = [...withConv].sort((a, b) => b.roas - a.roas);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best.roas > 0 && worst.roas / best.roas < 0.5) {
        findings.push({
          id: "demo-gender-gap",
          category: "efficiency",
          severity: "warning",
          title: `${label(best)} com ROAS ${best.roas.toFixed(1)} vs ${label(worst)} com ${worst.roas.toFixed(1)}`,
          description: `Diferença significativa de retorno entre gêneros. Realocar budget do ${label(worst)} para ${label(best)} pode melhorar eficiência.`,
          metrics: { current: worst.roas, target: best.roas, entityName: `${label(worst)} → ${label(best)}` },
          recommendations: [{
            action: `Realocar 20% do budget de ${label(worst)} para ${label(best)}`,
            impact: "medium",
            effort: "low",
          }],
          source: "pattern",
          financialImpact: quantifyBudgetReallocation(worst.costBRL * 0.2, worst.roas, best.roas),
        });
      }
    }
  }

  return findings;
}
