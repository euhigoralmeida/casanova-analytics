/* =========================
   Budget Optimizer
   Algoritmo greedy de alocação de budget por ROAS marginal.
   Recomenda redistribuição entre SKUs/campanhas.
========================= */

import type { DataCube, SkuSlice } from "../data-layer/types";
import { formatBRL } from "@/lib/format";

export type BudgetAllocation = {
  entity: string;       // SKU ID
  entityName: string;
  currentBudget: number;
  recommendedBudget: number;
  delta: number;        // recommendedBudget - currentBudget
  expectedRoas: number;
  expectedRevenue: number;
  rationale: string;
};

export type BudgetPlan = {
  totalBudget: number;
  allocations: BudgetAllocation[];
  expectedTotalRevenue: number;
  expectedTotalRoas: number;
  currentTotalRoas: number;
  improvementBRL: number;   // expected revenue gain
  confidence: number;
};

/**
 * Otimiza alocação de budget entre SKUs.
 *
 * Estratégia:
 * 1. Identifica SKUs com ROAS alto subinvestidos (destinos)
 * 2. Identifica SKUs com ROAS baixo sobreinvestidos (fontes)
 * 3. Propõe realocação com desconto de 30% por retorno decrescente
 * 4. Nunca propõe mais que 50% de redução de um SKU
 *
 * @param cube DataCube com dados atuais
 * @param minRoas ROAS mínimo para manter investimento (default: 5)
 */
export function optimizeBudget(cube: DataCube, minRoas: number = 5): BudgetPlan | null {
  if (!cube.account || cube.skus.length < 3) return null;

  const totalBudget = cube.account.ads;
  if (totalBudget < 500) return null;

  // Filter SKUs with meaningful spend
  const activeSKUs = cube.skus.filter((s) => s.ads > 50);
  if (activeSKUs.length < 3) return null;

  const avgRoas = cube.account.roas;

  // Categorize SKUs
  const sources: SkuSlice[] = []; // Low ROAS — reduce budget
  const destinations: SkuSlice[] = []; // High ROAS — increase budget
  const keepers: SkuSlice[] = []; // Moderate — keep same

  for (const sku of activeSKUs) {
    if (sku.roas < minRoas && sku.ads > 100) {
      sources.push(sku);
    } else if (sku.roas > avgRoas * 1.3 && sku.conversions >= 2) {
      destinations.push(sku);
    } else {
      keepers.push(sku);
    }
  }

  if (sources.length === 0 || destinations.length === 0) return null;

  // Sort: sources by ROAS ascending (worst first), destinations by ROAS descending (best first)
  sources.sort((a, b) => a.roas - b.roas);
  destinations.sort((a, b) => b.roas - a.roas);

  // Calculate total budget to reallocate (max 50% of each source)
  let budgetToReallocate = 0;
  const sourceAllocations: BudgetAllocation[] = [];

  for (const src of sources) {
    // Reduce by up to 50% for low ROAS, or 30% for moderate
    const reductionPct = src.roas < 3 ? 0.5 : src.roas < minRoas ? 0.3 : 0.2;
    const reduction = Math.round(src.ads * reductionPct * 100) / 100;
    budgetToReallocate += reduction;

    sourceAllocations.push({
      entity: src.sku,
      entityName: src.nome,
      currentBudget: src.ads,
      recommendedBudget: Math.round((src.ads - reduction) * 100) / 100,
      delta: -reduction,
      expectedRoas: src.roas, // ROAS may improve with less spend
      expectedRevenue: Math.round((src.ads - reduction) * src.roas * 100) / 100,
      rationale: `Reduzir ${(reductionPct * 100).toFixed(0)}%: ROAS ${src.roas.toFixed(1)} abaixo do mínimo ${minRoas}`,
    });
  }

  if (budgetToReallocate < 100) return null;

  // Distribute budget to destinations proportionally to ROAS
  const totalDestRoas = destinations.reduce((s, d) => s + d.roas, 0);
  const destAllocations: BudgetAllocation[] = [];

  for (const dest of destinations) {
    const share = totalDestRoas > 0 ? dest.roas / totalDestRoas : 1 / destinations.length;
    const increase = Math.round(budgetToReallocate * share * 100) / 100;
    // Apply 30% discount for diminishing returns
    const effectiveRoas = dest.roas * 0.7;

    destAllocations.push({
      entity: dest.sku,
      entityName: dest.nome,
      currentBudget: dest.ads,
      recommendedBudget: Math.round((dest.ads + increase) * 100) / 100,
      delta: increase,
      expectedRoas: Math.round(effectiveRoas * 100) / 100,
      expectedRevenue: Math.round((dest.ads + increase) * effectiveRoas * 100) / 100,
      rationale: `Aumentar ${formatBRL(increase)}: ROAS ${dest.roas.toFixed(1)} (est. ${effectiveRoas.toFixed(1)} com escala)`,
    });
  }

  // Calculate improvement
  const currentSourceRevenue = sources.reduce((s, sk) => s + sk.revenue, 0);
  const newSourceRevenue = sourceAllocations.reduce((s, a) => s + a.expectedRevenue, 0);
  const currentDestRevenue = destinations.reduce((s, sk) => s + sk.revenue, 0);
  const newDestRevenue = destAllocations.reduce((s, a) => s + a.expectedRevenue, 0);

  const currentTotal = currentSourceRevenue + currentDestRevenue;
  const newTotal = newSourceRevenue + newDestRevenue;
  const improvementBRL = Math.round((newTotal - currentTotal) * 100) / 100;

  // Combine all allocations (only show changes > R$50)
  const allocations = [...sourceAllocations, ...destAllocations]
    .filter((a) => Math.abs(a.delta) > 50)
    .sort((a, b) => b.delta - a.delta); // Increases first

  const expectedTotalRevenue = cube.account.revenue + improvementBRL;
  const expectedTotalRoas = totalBudget > 0 ? Math.round((expectedTotalRevenue / totalBudget) * 100) / 100 : 0;

  return {
    totalBudget,
    allocations,
    expectedTotalRevenue: Math.round(expectedTotalRevenue * 100) / 100,
    expectedTotalRoas,
    currentTotalRoas: avgRoas,
    improvementBRL: Math.max(improvementBRL, 0),
    confidence: 0.5,
  };
}
