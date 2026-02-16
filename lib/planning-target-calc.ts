import type {
  MonthlyValues,
  PlanningRowDef,
  PlanningYearData,
} from "@/types/api";

/* =========================
   Safe math helpers (shared with planning-calc.ts)
========================= */

function safeDiv(num: number | undefined, den: number | undefined): number | null {
  if (num == null || den == null || den === 0) return null;
  return num / den;
}

/* =========================
   Row definitions — exact order from "Planejamento 2026" spreadsheet
========================= */

export const PLANNING_TARGET_ROWS: PlanningRowDef[] = [
  { key: "receita_captada", label: "Receita Captada", type: "calc", format: "currency", formula: "Pedidos Captados × Ticket Médio" },
  { key: "aquisicao", label: "- Aquisição", type: "calc", format: "currency", formula: "Receita Captada × % Aquisição" },
  { key: "pct_aquisicao", label: "--- % Aquisição", type: "calc", format: "percent", formula: "1 − % Retenção" },
  { key: "pedidos_aquisicao", label: "Pedidos Aquisição", type: "calc", format: "number", formula: "Aquisição ÷ Ticket Médio" },
  { key: "retencao", label: "- Retenção", type: "calc", format: "currency", formula: "Receita Captada × % Retenção" },
  { key: "pct_retencao", label: "--- % Retenção", type: "input", format: "percent" },
  { key: "pedidos_retencao", label: "Pedidos Retenção", type: "calc", format: "number", formula: "Retenção ÷ Ticket Médio" },
  { key: "receita_faturada", label: "Receita Faturada", type: "calc", format: "currency", formula: "Receita Captada × % Aprovação" },
  { key: "receita_cancelada", label: "Receita Cancelada", type: "calc", format: "currency", formula: "Receita Captada − Receita Faturada" },
  { key: "pct_aprovacao_receita", label: "% de Aprovação Receita", type: "input", format: "percent" },
  { key: "pedidos_captados", label: "Pedidos Captados", type: "calc", format: "number", formula: "Sessões × Taxa de Conversão" },
  { key: "pedidos_faturados", label: "Pedidos Faturados", type: "calc", format: "number", formula: "Receita Faturada ÷ Ticket Médio" },
  { key: "ticket_medio_real", label: "Ticket Médio (Real)", type: "input", format: "currency" },
  { key: "taxa_conversao_real", label: "Taxa de Conversão Real", type: "input", format: "percent" },
  { key: "cpa_real", label: "CPA (Real)", type: "calc", format: "currency", formula: "Investimento Total ÷ Pedidos Captados" },
  { key: "investimento_total", label: "Investimento Total", type: "input", format: "currency" },
  { key: "invest_midia_paga", label: "Invest. Mídia Paga (Google + Meta)", type: "input", format: "currency" },
  { key: "invest_grupos_email", label: "Invest. em Grupos/Email", type: "input", format: "currency" },
  { key: "invest_impulsionamento", label: "Invest. em Impulsionamento", type: "input", format: "currency" },
  { key: "sessoes", label: "Sessões", type: "calc", format: "number", formula: "Sessões Mídia + Sessões Orgânicas" },
  { key: "sessoes_midia", label: "Sessões Mídia", type: "calc", format: "number", formula: "Invest. Mídia Paga ÷ CPS (Mídia)" },
  { key: "sessoes_organicas", label: "Sessões Orgânicas", type: "input", format: "number" },
  { key: "cps_geral", label: "CPS (Geral)", type: "calc", format: "currency", formula: "Investimento Total ÷ Sessões" },
  { key: "cps_midia", label: "CPS (Mídia)", type: "input", format: "currency" },
  { key: "roas_captado", label: "ROAS Captado", type: "calc", format: "number2", formula: "Receita Captada ÷ Investimento Total" },
  { key: "roas_faturado", label: "ROAS Faturado", type: "calc", format: "number2", formula: "Receita Faturada ÷ Investimento Total" },
  { key: "mes_a_mes", label: "Mês / Mês", type: "calc", format: "percent", formula: "Receita Captada[m] ÷ Receita Captada[m-1] − 1" },
  { key: "yoy", label: "2025 / 2024", type: "calc", format: "percent", formula: "Placeholder" },
];

/* =========================
   Compute calculated values for a single month
   Follows the cascade order from the plan
========================= */

export function computeTargetMonth(inputs: MonthlyValues): MonthlyValues {
  const calc: MonthlyValues = {};

  // 1. Sessões Mídia = Invest. Mídia Paga ÷ CPS (Mídia)
  const sessoesMidia = safeDiv(inputs.invest_midia_paga, inputs.cps_midia);
  if (sessoesMidia != null) calc.sessoes_midia = Math.round(sessoesMidia);

  // 2. Sessões = Sessões Mídia + Sessões Orgânicas
  const sm = calc.sessoes_midia ?? 0;
  const so = inputs.sessoes_organicas ?? 0;
  if (sm > 0 || so > 0) calc.sessoes = sm + so;

  // 3. Pedidos Captados = Sessões × Taxa de Conversão
  const sessoes = calc.sessoes;
  if (sessoes != null && inputs.taxa_conversao_real != null && inputs.taxa_conversao_real > 0) {
    calc.pedidos_captados = sessoes * inputs.taxa_conversao_real;
  }

  // 4. Receita Captada = Pedidos Captados × Ticket Médio
  if (calc.pedidos_captados != null && inputs.ticket_medio_real != null) {
    calc.receita_captada = Math.round(calc.pedidos_captados * inputs.ticket_medio_real * 100) / 100;
  }

  // 5. % Aquisição = 1 − % Retenção
  if (inputs.pct_retencao != null) {
    calc.pct_aquisicao = 1 - inputs.pct_retencao;
  }

  // 6. Aquisição = Receita Captada × % Aquisição
  if (calc.receita_captada != null && calc.pct_aquisicao != null) {
    calc.aquisicao = Math.round(calc.receita_captada * calc.pct_aquisicao * 100) / 100;
  }

  // 7. Pedidos Aquisição = Aquisição ÷ Ticket Médio
  const pedAq = safeDiv(calc.aquisicao, inputs.ticket_medio_real);
  if (pedAq != null) calc.pedidos_aquisicao = Math.round(pedAq);

  // 8. Retenção = Receita Captada × % Retenção
  if (calc.receita_captada != null && inputs.pct_retencao != null) {
    calc.retencao = Math.round(calc.receita_captada * inputs.pct_retencao * 100) / 100;
  }

  // 9. Pedidos Retenção = Retenção ÷ Ticket Médio
  const pedRet = safeDiv(calc.retencao, inputs.ticket_medio_real);
  if (pedRet != null) calc.pedidos_retencao = Math.round(pedRet);

  // 10. Receita Faturada = Receita Captada × % Aprovação
  if (calc.receita_captada != null && inputs.pct_aprovacao_receita != null) {
    calc.receita_faturada = Math.round(calc.receita_captada * inputs.pct_aprovacao_receita * 100) / 100;
  }

  // 11. Receita Cancelada = Receita Captada − Receita Faturada
  if (calc.receita_captada != null && calc.receita_faturada != null) {
    calc.receita_cancelada = Math.round((calc.receita_captada - calc.receita_faturada) * 100) / 100;
  }

  // 12. Pedidos Faturados = Receita Faturada ÷ Ticket Médio
  const pedFat = safeDiv(calc.receita_faturada, inputs.ticket_medio_real);
  if (pedFat != null) calc.pedidos_faturados = Math.round(pedFat);

  // 13. CPA (Real) = Investimento Total ÷ Pedidos Captados
  const cpa = safeDiv(inputs.investimento_total, calc.pedidos_captados);
  if (cpa != null) calc.cpa_real = Math.round(cpa * 100) / 100;

  // 14. CPS (Geral) = Investimento Total ÷ Sessões
  const cps = safeDiv(inputs.investimento_total, calc.sessoes);
  if (cps != null) calc.cps_geral = Math.round(cps * 100) / 100;

  // 15. ROAS Captado = Receita Captada ÷ Investimento Total
  const roasC = safeDiv(calc.receita_captada, inputs.investimento_total);
  if (roasC != null) calc.roas_captado = Math.round(roasC * 100) / 100;

  // 16. ROAS Faturado = Receita Faturada ÷ Investimento Total
  const roasF = safeDiv(calc.receita_faturada, inputs.investimento_total);
  if (roasF != null) calc.roas_faturado = Math.round(roasF * 100) / 100;

  // 17-18: mes_a_mes and yoy are computed at the year level, not per-month
  // They require access to adjacent months

  return calc;
}

/* =========================
   Compute the TOTAL column (annual aggregation)
========================= */

export function computeTargetTotals(yearData: PlanningYearData): MonthlyValues {
  const inputKeys = PLANNING_TARGET_ROWS.filter((r) => r.type === "input").map((r) => r.key);
  const pctInputs = new Set(["pct_retencao", "pct_aprovacao_receita", "taxa_conversao_real", "cps_midia"]);

  // Sum non-percentage inputs; average percentage inputs
  const totals: MonthlyValues = {};
  const pctSums: Record<string, { sum: number; count: number }> = {};

  for (let m = 1; m <= 12; m++) {
    const mv = yearData[m];
    if (!mv) continue;
    for (const key of inputKeys) {
      if (mv[key] == null) continue;
      if (pctInputs.has(key)) {
        if (!pctSums[key]) pctSums[key] = { sum: 0, count: 0 };
        pctSums[key].sum += mv[key]!;
        pctSums[key].count++;
      } else {
        totals[key] = (totals[key] ?? 0) + mv[key]!;
      }
    }
  }

  // Apply averages for percentage inputs
  for (const [key, { sum, count }] of Object.entries(pctSums)) {
    if (count > 0) totals[key] = sum / count;
  }

  // Compute calculated metrics on aggregated totals
  const calc = computeTargetMonth(totals);
  return { ...totals, ...calc };
}

/* =========================
   Compute the MÉDIA column
========================= */

export function computeTargetAverage(yearData: PlanningYearData): MonthlyValues {
  const totals = computeTargetTotals(yearData);

  // Count months with data
  let monthsWithData = 0;
  for (let m = 1; m <= 12; m++) {
    const mv = yearData[m];
    if (mv && Object.keys(mv).length > 0) monthsWithData++;
  }
  if (monthsWithData === 0) return {};

  // Average = total ÷ months with data (for summed inputs)
  const inputKeys = PLANNING_TARGET_ROWS.filter((r) => r.type === "input").map((r) => r.key);
  const pctInputs = new Set(["pct_retencao", "pct_aprovacao_receita", "taxa_conversao_real", "cps_midia"]);

  const avgInputs: MonthlyValues = {};
  for (const key of inputKeys) {
    if (totals[key] == null) continue;
    if (pctInputs.has(key)) {
      // Percentages are already averaged in totals
      avgInputs[key] = totals[key];
    } else {
      avgInputs[key] = Math.round((totals[key]! / monthsWithData) * 100) / 100;
    }
  }

  // Recalculate from averaged inputs
  const calc = computeTargetMonth(avgInputs);
  return { ...avgInputs, ...calc };
}

/* =========================
   Compute all months + totals + average for a full year
========================= */

export function computeTargetFullYear(
  yearData: PlanningYearData
): { months: Record<number, MonthlyValues>; totals: MonthlyValues; average: MonthlyValues } {
  const months: Record<number, MonthlyValues> = {};

  // Compute each month
  for (let m = 1; m <= 12; m++) {
    const inputs = yearData[m] ?? {};
    const calc = computeTargetMonth(inputs);
    months[m] = { ...inputs, ...calc };
  }

  // Compute Mês / Mês for each month (needs previous month's receita_captada)
  for (let m = 2; m <= 12; m++) {
    const currentRevenue = months[m]?.receita_captada;
    const prevRevenue = months[m - 1]?.receita_captada;
    if (currentRevenue != null && prevRevenue != null && prevRevenue > 0) {
      months[m].mes_a_mes = (currentRevenue / prevRevenue) - 1;
    }
  }

  const totals = computeTargetTotals(yearData);
  const average = computeTargetAverage(yearData);

  return { months, totals, average };
}
