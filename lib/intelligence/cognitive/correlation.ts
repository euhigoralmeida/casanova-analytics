/* =========================
   Correlation Engine
   Pattern matching simplificado para identificar causas raiz
   entre findings produzidos pelos 5 analyzers.
========================= */

import type { CognitiveFinding } from "./types";

type CausalPattern = {
  id: string;
  trigger: {
    category: string;
    severityMin?: "success" | "warning" | "danger";
    idPattern?: RegExp;
  };
  evidence: {
    category: string;
    idPattern?: RegExp;
  };
  rootCauseTemplate: string;
};

const SEVERITY_ORDER: Record<string, number> = { success: 0, warning: 1, danger: 2 };

function severityMeets(actual: string, minimum?: string): boolean {
  if (!minimum) return true;
  return (SEVERITY_ORDER[actual] ?? 0) >= (SEVERITY_ORDER[minimum] ?? 0);
}

/**
 * Padrões causais pré-definidos.
 * Cada padrão liga um "trigger" finding a um "evidence" finding
 * para identificar causa raiz.
 */
const CAUSAL_PATTERNS: CausalPattern[] = [
  {
    id: "budget-misallocation",
    trigger: { category: "planning_gap", severityMin: "warning", idPattern: /^pg-(revenue|roas)/ },
    evidence: { category: "efficiency", idPattern: /^eff-(zero-conv|low-roas|budget-dist)/ },
    rootCauseTemplate: "Receita abaixo da meta porque parte do budget está alocado em SKUs/campanhas com baixo retorno",
  },
  {
    id: "traffic-quality",
    trigger: { category: "risk", idPattern: /^risk-bounce/ },
    evidence: { category: "composition", idPattern: /^comp-paid-heavy/ },
    rootCauseTemplate: "Alta taxa de rejeição combinada com dependência de tráfego pago indica problemas de qualidade de tráfego",
  },
  {
    id: "reallocation-opportunity",
    trigger: { category: "opportunity", idPattern: /^opp-(underinvested|scalable)/ },
    evidence: { category: "efficiency", idPattern: /^eff-(zero-conv|low-roas|high-cpa|budget-dist)/ },
    rootCauseTemplate: "Existem SKUs com alto potencial subinvestidos enquanto budget é desperdiçado em SKUs ineficientes",
  },
  {
    id: "conversion-bottleneck",
    trigger: { category: "risk", idPattern: /^risk-cart-abandon/ },
    evidence: { category: "planning_gap", idPattern: /^pg-(revenue|conversion)/ },
    rootCauseTemplate: "Problema de conversão no funil está contribuindo para o gap de receita vs planejamento",
  },
  {
    id: "device-inefficiency",
    trigger: { category: "efficiency", idPattern: /^dev-mobile-low-roas/ },
    evidence: { category: "efficiency", idPattern: /^eff-(budget-dist|low-roas)/ },
    rootCauseTemplate: "Budget em Mobile com baixo ROAS está contribuindo para ineficiência geral da operação",
  },
  {
    id: "geo-concentration",
    trigger: { category: "risk", idPattern: /^geo-top-region/ },
    evidence: { category: "risk", idPattern: /^risk-/ },
    rootCauseTemplate: "Concentração geográfica amplifica o risco de dependência da operação",
  },
];

/**
 * Correlaciona findings usando padrões causais.
 * Enriquece com rootCause e relatedFindingIds.
 * Findings sem correlação passam inalterados.
 */
export function correlateFindings(findings: CognitiveFinding[]): CognitiveFinding[] {
  // Build lookup maps
  const byCategory = new Map<string, CognitiveFinding[]>();
  for (const f of findings) {
    const arr = byCategory.get(f.category) ?? [];
    arr.push(f);
    byCategory.set(f.category, arr);
  }

  // Track correlations by finding ID
  const correlations = new Map<string, {
    rootCause: string;
    relatedIds: string[];
    correlationId: string;
  }>();

  for (const pattern of CAUSAL_PATTERNS) {
    const triggerCandidates = byCategory.get(pattern.trigger.category) ?? [];
    const triggers = triggerCandidates.filter((f) => {
      if (!severityMeets(f.severity, pattern.trigger.severityMin)) return false;
      if (pattern.trigger.idPattern && !pattern.trigger.idPattern.test(f.id)) return false;
      return true;
    });

    if (triggers.length === 0) continue;

    const evidenceCandidates = byCategory.get(pattern.evidence.category) ?? [];
    const evidences = evidenceCandidates.filter((f) => {
      if (pattern.evidence.idPattern && !pattern.evidence.idPattern.test(f.id)) return false;
      return true;
    });

    if (evidences.length === 0) continue;

    // Link triggers to evidence
    for (const trigger of triggers) {
      if (!correlations.has(trigger.id)) {
        correlations.set(trigger.id, {
          rootCause: pattern.rootCauseTemplate,
          relatedIds: evidences.map((e) => e.id),
          correlationId: pattern.id,
        });
      }

      for (const evidence of evidences) {
        if (!correlations.has(evidence.id)) {
          correlations.set(evidence.id, {
            rootCause: `Relacionado a: ${trigger.title}`,
            relatedIds: [trigger.id],
            correlationId: pattern.id,
          });
        }
      }
    }
  }

  // Return enriched findings
  return findings.map((f) => {
    const corr = correlations.get(f.id);
    if (!corr) return f;

    return {
      ...f,
      rootCause: corr.rootCause,
      relatedFindingIds: corr.relatedIds,
      correlationId: corr.correlationId,
    };
  });
}
