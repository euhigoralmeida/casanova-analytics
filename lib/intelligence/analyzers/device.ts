/* =========================
   Analyzer: Dispositivo
   Mobile vs Desktop vs Tablet — ROAS, CPA, conversão por dispositivo
========================= */

import type { AnalysisContext } from "../types";
import type { CognitiveFinding } from "../cognitive/types";
import type { DataCube } from "../data-layer/types";
import { formatBRL } from "@/lib/format";
import { quantifyBudgetReallocation, quantifyUnderinvestment, quantifyWastedSpend } from "../cognitive/financial-impact";

export function analyzeDevices(_ctx: AnalysisContext, cube: DataCube): CognitiveFinding[] {
  const findings: CognitiveFinding[] = [];
  if (!cube.devices || cube.devices.length === 0) return findings;

  const mobile = cube.devices.find((d) => d.device === "MOBILE");
  const desktop = cube.devices.find((d) => d.device === "DESKTOP");
  const tablet = cube.devices.find((d) => d.device === "TABLET");

  // 1. Mobile ROAS muito abaixo do Desktop
  if (mobile && desktop && desktop.roas > 0 && mobile.costBRL > 100) {
    const ratio = mobile.roas / desktop.roas;
    if (ratio < 0.5) {
      const severity = ratio < 0.3 ? "danger" as const : "warning" as const;
      findings.push({
        id: "dev-mobile-low-roas",
        category: "efficiency",
        severity,
        title: `Mobile com ROAS ${mobile.roas.toFixed(1)} vs Desktop ${desktop.roas.toFixed(1)}`,
        description: `Mobile representa ${mobile.revenueShare.toFixed(0)}% da receita mas ROAS é ${(ratio * 100).toFixed(0)}% do Desktop. Considere realocar budget.`,
        metrics: { current: mobile.roas, target: desktop.roas, gap: ((mobile.roas - desktop.roas) / desktop.roas) * 100 },
        recommendations: [{
          action: "Reduzir lance mobile em 30% e realocar para Desktop",
          impact: "high",
          effort: "low",
          steps: [
            "Ajustar bid modifier mobile para -30% nas campanhas principais",
            "Monitorar impacto por 7 dias",
          ],
        }],
        source: "pattern",
        financialImpact: quantifyBudgetReallocation(mobile.costBRL * 0.3, mobile.roas, desktop.roas),
      });
    }
  }

  // 2. Desktop com alto ROAS e share baixo (oportunidade de escalar)
  if (desktop && desktop.roas > 7 && desktop.revenueShare < 40) {
    const totalSpend = cube.devices.reduce((s, d) => s + d.costBRL, 0);
    const avgSpend = totalSpend / cube.devices.length;

    findings.push({
      id: "dev-desktop-opportunity",
      category: "opportunity",
      severity: "success",
      title: `Desktop com ROAS ${desktop.roas.toFixed(1)} e apenas ${desktop.revenueShare.toFixed(0)}% da receita`,
      description: `Desktop tem o melhor retorno por dispositivo. Aumentar investimento pode gerar receita incremental.`,
      metrics: { current: desktop.revenueShare, target: 50, entityName: "Desktop" },
      recommendations: [{
        action: "Aumentar investimento em Desktop em 20-30%",
        impact: "high",
        effort: "low",
      }],
      source: "pattern",
      financialImpact: quantifyUnderinvestment(desktop.costBRL, avgSpend, desktop.roas),
    });
  }

  // 3. Tablet com conversão zero e spend > R$100
  if (tablet && tablet.conversions === 0 && tablet.costBRL > 100) {
    findings.push({
      id: "dev-tablet-waste",
      category: "efficiency",
      severity: "warning",
      title: `Tablet gastando ${formatBRL(tablet.costBRL)} sem conversões`,
      description: `Investimento em Tablet não gerou nenhuma conversão no período. Considere pausar ou excluir Tablet das campanhas.`,
      metrics: { current: tablet.costBRL, entityName: "Tablet" },
      recommendations: [{
        action: "Excluir Tablet das campanhas ou reduzir bid para -100%",
        impact: "medium",
        effort: "low",
      }],
      source: "pattern",
      financialImpact: quantifyWastedSpend(tablet.costBRL),
    });
  }

  return findings;
}
