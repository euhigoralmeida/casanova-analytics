import type {
  MonthlyValues,
  PlanningRowDef,
  PlanningYearData,
} from "@/types/api";

/* =========================
   Safe math helpers
========================= */

function safeDiv(num: number | undefined, den: number | undefined): number | null {
  if (num == null || den == null || den === 0) return null;
  return num / den;
}

function safeSum(...vals: (number | undefined)[]): number | null {
  let hasAny = false;
  let total = 0;
  for (const v of vals) {
    if (v != null) {
      hasAny = true;
      total += v;
    }
  }
  return hasAny ? total : null;
}

function safeSub(a: number | undefined, b: number | undefined): number | null {
  if (a == null) return null;
  return a - (b ?? 0);
}

/* =========================
   Row definitions — exact order from the spreadsheet
========================= */

export const PLANNING_ROWS: PlanningRowDef[] = [
  { key: "receita_captada", label: "Receita Captada Loja", type: "input", format: "currency" },
  { key: "descontos_cliente", label: "Descontos à Cliente", type: "input", format: "currency" },
  { key: "pct_descontos_cliente", label: "%Descontos à Cliente", type: "calc", format: "percent", formula: "Descontos à Cliente ÷ Receita Captada Loja" },
  { key: "acrescimos_cliente", label: "Acréscimos à Cliente", type: "calc", format: "currency", formula: "Receita Captada Loja − Receita Faturada Loja" },
  { key: "receita_faturada", label: "Receita Faturada Loja (Loja)", type: "input", format: "currency" },
  { key: "receita_cancelada", label: "Receita Cancelada", type: "calc", format: "currency", formula: "Receita Captada Loja − Receita Faturada Loja" },
  { key: "taxa_aprovacao_pedidos", label: "Taxa de aprovação de pedidos", type: "calc", format: "percent", formula: "Receita Faturada ÷ Receita Captada" },
  { key: "investimento_ads", label: "Investimento [ADS]", type: "calc", format: "currency", formula: "Google ADS + Meta ADS" },
  { key: "google_ads", label: "Google ADS", type: "input", format: "currency" },
  { key: "meta_ads", label: "Meta ADS", type: "input", format: "currency" },
  { key: "pct_investimento_acos", label: "% Investimento anúncio | ACOS", type: "calc", format: "percent", formula: "Investimento [ADS] ÷ Receita Faturada" },
  { key: "usuarios_visitantes", label: "Usuários / Visitantes", type: "input", format: "number" },
  { key: "sessoes_totais", label: "Sessões Totais", type: "input", format: "number" },
  { key: "sessoes_midia", label: "Sessões Mídia", type: "input", format: "number" },
  { key: "sessoes_organicas", label: "Sessões Orgânicas", type: "input", format: "number" },
  { key: "sessoes_engajadas", label: "Sessões Engajadas", type: "input", format: "number" },
  { key: "taxa_rejeicao", label: "Taxa de rejeição", type: "input", format: "percent" },
  { key: "pedido_captado", label: "Pedido Captado (Loja)", type: "input", format: "number" },
  { key: "pedido_pago", label: "Pedido Pago (Loja)", type: "input", format: "number" },
  { key: "carrinhos_criados", label: "Carrinhos Criados", type: "input", format: "number" },
  { key: "carrinhos_abandonados", label: "Carrinhos Abandonados", type: "input", format: "number" },
  { key: "taxa_abandono_carrinho", label: "Taxa de Abandono de Carrinho", type: "calc", format: "percent", formula: "(Carrinhos Criados − Pedido Captado) ÷ Carrinhos Criados" },
  { key: "pct_visitantes_carrinho", label: "%Visitantes/Carrinho", type: "calc", format: "percent", formula: "Carrinhos Criados ÷ Usuários / Visitantes" },
  { key: "pct_carrinho_pedido", label: "%Carrinho/Pedido", type: "calc", format: "percent", formula: "Pedido Captado ÷ Carrinhos Criados" },
  { key: "pct_carrinho_pedido_pago", label: "%Carrinho/Pedido Pago", type: "calc", format: "percent", formula: "Pedido Pago ÷ Carrinhos Criados" },
  { key: "ticket_medio_captado", label: "Ticket Médio (Captado)", type: "calc", format: "currency", formula: "Receita Captada ÷ Pedido Captado" },
  { key: "ticket_medio_pago", label: "Ticket Médio (Pago)", type: "calc", format: "currency", formula: "Receita Faturada ÷ Pedido Pago" },
  { key: "taxa_conversao_captado", label: "Taxa de conversão (Captado)", type: "calc", format: "percent", formula: "Pedido Captado ÷ Sessões Totais" },
  { key: "taxa_conversao_pago", label: "Taxa de conversão (Pago)", type: "calc", format: "percent", formula: "Pedido Pago ÷ Sessões Totais" },
  { key: "cps_geral", label: "CPS [Geral]", type: "calc", format: "currency", formula: "Investimento [ADS] ÷ Sessões Totais" },
  { key: "cpa_geral", label: "CPA [Geral]", type: "calc", format: "currency", formula: "Investimento [ADS] ÷ Pedido Captado" },
  { key: "roas_captado", label: "ROAS [Captado Loja]", type: "calc", format: "number2", formula: "Receita Captada ÷ Investimento [ADS]" },
  { key: "roas_pago", label: "ROAS [Pago Loja]", type: "calc", format: "number2", formula: "Receita Faturada ÷ Investimento [ADS]" },
  { key: "pct_midia_captado", label: "% Em mídia [Captado]", type: "calc", format: "percent", formula: "Investimento [ADS] ÷ Receita Captada" },
  { key: "pct_midia_pago", label: "% Em mídia [Pago]", type: "calc", format: "percent", formula: "Investimento [ADS] ÷ Receita Faturada" },
];

/* =========================
   Compute calculated values for a single month
========================= */

export function computeMonth(inputs: MonthlyValues): MonthlyValues {
  const v = { ...inputs };
  const calc: MonthlyValues = {};

  // Receita Faturada is now INPUT; use it directly
  const receitaFaturada = v.receita_faturada ?? 0;
  const investimento = (v.google_ads ?? 0) + (v.meta_ads ?? 0);

  // Acréscimos = Receita Captada - Receita Faturada
  if (v.receita_captada != null && v.receita_faturada != null) {
    calc.acrescimos_cliente = Math.round((v.receita_captada - receitaFaturada) * 100) / 100;
  }

  // Receita Cancelada = Receita Captada - Receita Faturada
  if (v.receita_captada != null && v.receita_faturada != null) {
    calc.receita_cancelada = Math.round((v.receita_captada - receitaFaturada) * 100) / 100;
  }

  calc.investimento_ads = investimento > 0 || v.google_ads != null || v.meta_ads != null
    ? Math.round(investimento * 100) / 100
    : undefined;

  // %Descontos = Descontos / Receita Captada
  const pctDesc = safeDiv(v.descontos_cliente, v.receita_captada);
  if (pctDesc != null) calc.pct_descontos_cliente = pctDesc;

  // Taxa aprovação = Receita Faturada / Receita Captada
  if (v.receita_captada != null && v.receita_captada > 0) {
    calc.taxa_aprovacao_pedidos = safeDiv(receitaFaturada, v.receita_captada) ?? undefined;
  }

  // % Investimento / ACOS = Investimento / Receita Faturada
  if (receitaFaturada > 0) {
    calc.pct_investimento_acos = safeDiv(investimento, receitaFaturada) ?? undefined;
  }

  // Taxa de Abandono de Carrinho = (Carrinhos Criados - Pedido Captado) / Carrinhos Criados
  if (v.carrinhos_criados != null && v.carrinhos_criados > 0) {
    calc.taxa_abandono_carrinho = ((v.carrinhos_criados - (v.pedido_captado ?? 0)) / v.carrinhos_criados);
  }

  // Sessões Orgânicas agora é input (sincronizado do GA4: Organic Search + Social + Shopping)

  // %Visitantes/Carrinho = Carrinhos / Usuários
  calc.pct_visitantes_carrinho = safeDiv(v.carrinhos_criados, v.usuarios_visitantes) ?? undefined;

  // %Carrinho/Pedido = Pedido Captado / Carrinhos
  calc.pct_carrinho_pedido = safeDiv(v.pedido_captado, v.carrinhos_criados) ?? undefined;

  // %Carrinho/Pedido Pago = Pedido Pago / Carrinhos
  calc.pct_carrinho_pedido_pago = safeDiv(v.pedido_pago, v.carrinhos_criados) ?? undefined;

  // Ticket Médio (Captado) = Receita Captada / Pedido Captado
  calc.ticket_medio_captado = safeDiv(v.receita_captada, v.pedido_captado) ?? undefined;

  // Ticket Médio (Pago) = Receita Faturada / Pedido Pago
  if (receitaFaturada > 0) {
    calc.ticket_medio_pago = safeDiv(receitaFaturada, v.pedido_pago) ?? undefined;
  }

  // Taxa conversão (Captado) = Pedido Captado / Sessões Totais
  calc.taxa_conversao_captado = safeDiv(v.pedido_captado, v.sessoes_totais) ?? undefined;

  // Taxa conversão (Pago) = Pedido Pago / Sessões Totais
  calc.taxa_conversao_pago = safeDiv(v.pedido_pago, v.sessoes_totais) ?? undefined;

  // CPS = Investimento / Sessões Totais
  calc.cps_geral = safeDiv(investimento, v.sessoes_totais) ?? undefined;

  // CPA = Investimento / Pedido Captado
  calc.cpa_geral = safeDiv(investimento, v.pedido_captado) ?? undefined;

  // ROAS Captado = Receita Captada / Investimento
  calc.roas_captado = safeDiv(v.receita_captada, investimento) ?? undefined;

  // ROAS Pago = Receita Faturada / Investimento
  if (receitaFaturada > 0) {
    calc.roas_pago = safeDiv(receitaFaturada, investimento) ?? undefined;
  }

  // % Em mídia Captado = Investimento / Receita Captada
  calc.pct_midia_captado = safeDiv(investimento, v.receita_captada) ?? undefined;

  // % Em mídia Pago = Investimento / Receita Faturada
  if (receitaFaturada > 0) {
    calc.pct_midia_pago = safeDiv(investimento, receitaFaturada) ?? undefined;
  }

  return calc;
}

/* =========================
   Compute the TOTAL column (annual aggregation)
========================= */

export function computeTotals(yearData: PlanningYearData): MonthlyValues {
  // Sum all input metrics across months
  const totals: MonthlyValues = {};
  const sumKeys = PLANNING_ROWS.filter((r) => r.type === "input").map((r) => r.key);

  for (let m = 1; m <= 12; m++) {
    const mv = yearData[m];
    if (!mv) continue;
    for (const key of sumKeys) {
      if (mv[key] != null) {
        totals[key] = (totals[key] ?? 0) + mv[key]!;
      }
    }
  }

  // For percentage inputs, compute average instead of sum
  const pctInputs = ["taxa_rejeicao"];
  for (const key of pctInputs) {
    let count = 0;
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const val = yearData[m]?.[key];
      if (val != null) {
        count++;
        sum += val;
      }
    }
    if (count > 0) totals[key] = sum / count;
  }

  // Now compute calculated metrics based on total inputs
  const calc = computeMonth(totals);
  return { ...totals, ...calc };
}

/* =========================
   Compute all months + totals for a full year
========================= */

export function computeFullYear(
  yearData: PlanningYearData
): { months: Record<number, MonthlyValues>; totals: MonthlyValues } {
  const months: Record<number, MonthlyValues> = {};

  for (let m = 1; m <= 12; m++) {
    const inputs = yearData[m] ?? {};
    const calc = computeMonth(inputs);
    months[m] = { ...inputs, ...calc };
  }

  const totals = computeTotals(yearData);
  return { months, totals };
}
