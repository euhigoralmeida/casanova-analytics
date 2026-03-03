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

/* =========================
   Influencer slugs
========================= */

export const YELLA_INFLUENCERS = [
  { slug: "kamylla", name: "Kamylla" },
  { slug: "sonia_matte", name: "Sonia Matte" },
  { slug: "sophia_cit", name: "Sophia Cit" },
  { slug: "fernanca_vancine", name: "Fernanca Vancine" },
  { slug: "influ_5", name: "Influenciador 5" },
  { slug: "influ_6", name: "Influenciador 6" },
  { slug: "influ_7", name: "Influenciador 7" },
] as const;

/* =========================
   Section definitions for visual grouping
========================= */

export type YellaSectionDef = {
  id: string;
  label: string;
  color: string; // tailwind bg class
  textColor: string;
};

export const YELLA_SECTIONS: YellaSectionDef[] = [
  { id: "receita", label: "Receita & Custos", color: "bg-emerald-700", textColor: "text-white" },
  { id: "investimento", label: "Investimento Consolidado", color: "bg-blue-700", textColor: "text-white" },
  { id: "canais", label: "Canais de Mídia", color: "bg-indigo-700", textColor: "text-white" },
  { id: "influenciadores", label: "Influenciadores", color: "bg-purple-700", textColor: "text-white" },
  { id: "trafego", label: "Tráfego & Engajamento", color: "bg-amber-700", textColor: "text-white" },
  { id: "pedidos", label: "Pedidos & Carrinhos", color: "bg-orange-700", textColor: "text-white" },
  { id: "kpis", label: "KPIs Finais", color: "bg-zinc-800", textColor: "text-white" },
];

/* =========================
   Row definitions with sections
========================= */

export type YellaRowDef = PlanningRowDef & {
  section: string;
  indent?: number; // 0 = normal, 1 = sub-item, 2 = sub-sub
  /** When set, the label is editable and persisted under this metric key (stored as a dummy numeric — 0 = placeholder) */
  labelKey?: string;
  /** Default label text shown when no custom name is saved */
  labelPlaceholder?: string;
};

function influ(slug: string, name: string, editableName = false): YellaRowDef[] {
  const investRow: YellaRowDef = {
    key: `influ_${slug}_investimento`,
    label: `${name} (investimento)`,
    type: "input",
    format: "currency",
    section: "influenciadores",
    indent: 2,
  };
  if (editableName) {
    investRow.labelKey = `influ_${slug}_nome`;
    investRow.labelPlaceholder = name;
  }
  return [
    investRow,
    { key: `influ_${slug}_faturamento`, label: "Faturamento", type: "input", format: "currency", section: "influenciadores", indent: 2 },
    { key: `influ_${slug}_vendas`, label: "Vendas", type: "input", format: "number", section: "influenciadores", indent: 2 },
    { key: `influ_${slug}_roas`, label: "ROAS", type: "calc", format: "number2", section: "influenciadores", indent: 2, formula: "Faturamento ÷ Investimento" },
  ];
}

export const YELLA_PLANNING_ROWS: YellaRowDef[] = [
  // ─── Seção 1: Receita & Custos ───
  { key: "receita_captada", label: "Receita Captada (Valor da venda)", type: "input", format: "currency", section: "receita" },
  { key: "custo_afiliado", label: "Custo Afiliado", type: "input", format: "currency", section: "receita" },
  { key: "frete", label: "Frete", type: "input", format: "currency", section: "receita" },
  { key: "receita_faturada", label: "Receita faturada", type: "input", format: "currency", section: "receita" },
  { key: "voce_recebe", label: "Você Recebe", type: "input", format: "currency", section: "receita" },
  { key: "lucro_liquido", label: "Lucro líquido (sem mídia + influ)", type: "calc", format: "currency", section: "receita", formula: "Você Recebe − Investimento total mídia+influ" },
  { key: "receita_cancelada", label: "Receita Cancelada", type: "input", format: "currency", section: "receita" },
  { key: "taxa_aprovacao_pedidos", label: "Taxa de aprovação de pedidos", type: "calc", format: "percent", section: "receita", formula: "Você Recebe ÷ Receita Captada" },

  // ─── Seção 2: Investimento Consolidado ───
  { key: "investimento_total_midia_influ", label: "Investimento total em mídia + Influ", type: "calc", format: "currency", section: "investimento", formula: "Google ADS + Meta ADS + INFLU total" },
  { key: "faturamento_total_midia_influ", label: "Faturamento", type: "calc", format: "currency", section: "investimento", indent: 1, formula: "Soma faturamentos de todos canais + influ" },
  { key: "roas_total_midia_influ", label: "ROAS", type: "calc", format: "number2", section: "investimento", indent: 1, formula: "Faturamento ÷ Investimento total mídia+influ" },
  { key: "investimento_total_midia", label: "Investimento total em mídia", type: "calc", format: "currency", section: "investimento", formula: "Google ADS + Meta ADS" },
  { key: "faturamento_total_midia", label: "Faturamento", type: "calc", format: "currency", section: "investimento", indent: 1, formula: "Google ADS Fat + Meta ADS Fat" },
  { key: "roas_total_midia", label: "ROAS", type: "calc", format: "number2", section: "investimento", indent: 1, formula: "Faturamento mídia ÷ Investimento mídia" },

  // ─── Seção 3: Canais de Mídia ───
  { key: "google_ads", label: "Google ADS (investimento)", type: "input", format: "currency", section: "canais" },
  { key: "google_ads_faturamento", label: "Faturamento", type: "input", format: "currency", section: "canais", indent: 1 },
  { key: "google_ads_vendas", label: "Vendas", type: "input", format: "number", section: "canais", indent: 1 },
  { key: "google_ads_roas", label: "ROAS", type: "calc", format: "number2", section: "canais", indent: 1, formula: "Google ADS Faturamento ÷ Google ADS" },
  { key: "meta_ads", label: "Meta ADS (investimento)", type: "input", format: "currency", section: "canais" },
  { key: "meta_ads_faturamento", label: "Faturamento", type: "input", format: "currency", section: "canais", indent: 1 },
  { key: "meta_ads_vendas", label: "Vendas", type: "input", format: "number", section: "canais", indent: 1 },
  { key: "meta_ads_roas", label: "ROAS", type: "calc", format: "number2", section: "canais", indent: 1, formula: "Meta ADS Faturamento ÷ Meta ADS" },

  // ─── Seção 4: Influenciadores (consolidado) ───
  { key: "influ_investimento_total", label: "Investimento [INFLU]", type: "calc", format: "currency", section: "influenciadores", formula: "Soma investimentos influenciadores" },
  { key: "influ_faturamento_total", label: "Faturamento", type: "calc", format: "currency", section: "influenciadores", indent: 1, formula: "Soma faturamentos influenciadores" },
  { key: "influ_vendas_total", label: "Vendas", type: "calc", format: "number", section: "influenciadores", indent: 1, formula: "Soma vendas influenciadores" },
  { key: "influ_roas_total", label: "ROAS", type: "calc", format: "number2", section: "influenciadores", indent: 1, formula: "Faturamento INFLU ÷ Investimento INFLU" },

  // Individual influencers
  ...influ("kamylla", "Kamylla"),
  ...influ("sonia_matte", "Sonia Matte"),
  ...influ("sophia_cit", "Sophia Cit"),
  ...influ("fernanca_vancine", "Fernanca Vancine"),
  ...influ("influ_5", "Influenciador 5", true),
  ...influ("influ_6", "Influenciador 6", true),
  ...influ("influ_7", "Influenciador 7", true),

  // ─── Seção 5: Tráfego & Engajamento ───
  { key: "usuarios_visitantes", label: "Usuários / Visitantes", type: "input", format: "number", section: "trafego" },
  { key: "sessoes_totais", label: "Sessões Totais", type: "input", format: "number", section: "trafego" },
  { key: "sessoes_midia", label: "Sessões Mídia", type: "input", format: "number", section: "trafego" },
  { key: "sessoes_organicas", label: "Sessões Orgânicas", type: "input", format: "number", section: "trafego" },
  { key: "sessoes_engajadas", label: "Sessões Engajadas", type: "input", format: "number", section: "trafego" },
  { key: "taxa_engajamento", label: "Taxa de Engajamento", type: "calc", format: "percent", section: "trafego", formula: "Sessões Engajadas ÷ Sessões Totais" },
  { key: "taxa_rejeicao", label: "Taxa de rejeição", type: "input", format: "percent", section: "trafego" },

  // ─── Seção 6: Pedidos & Carrinhos ───
  { key: "pedido_captado", label: "Pedido Captado (Loja)", type: "input", format: "number", section: "pedidos" },
  { key: "pedido_pago", label: "Pedido Pago (Loja)", type: "input", format: "number", section: "pedidos" },
  { key: "carrinhos_abandonados", label: "Carrinhos Abandonados", type: "input", format: "number", section: "pedidos" },
  { key: "carrinhos_convertido", label: "Carrinhos Convertido", type: "input", format: "number", section: "pedidos" },
  { key: "taxa_abandono_carrinho", label: "Taxa de Abandono de Carrinho", type: "calc", format: "percent", section: "pedidos", formula: "Abandonados ÷ (Abandonados + Convertido)" },
  { key: "taxa_conversao_carrinho", label: "Taxa de conversão de Carrinho", type: "calc", format: "percent", section: "pedidos", formula: "Convertido ÷ Abandonados" },
  { key: "pct_visitantes_carrinho", label: "%Visitantes/Carrinho", type: "calc", format: "percent", section: "pedidos", formula: "Abandonados ÷ Visitantes" },
  { key: "pct_carrinho_pedido", label: "%Carrinho/Pedido", type: "calc", format: "percent", section: "pedidos", formula: "Pedido Captado ÷ (Abandonados + Convertido)" },
  { key: "pct_carrinho_pedido_pago", label: "%Carrinho/Pedido Pago", type: "calc", format: "percent", section: "pedidos", formula: "Pedido Pago ÷ (Abandonados + Convertido)" },

  // ─── Seção 7: KPIs Finais ───
  { key: "ticket_medio_captado", label: "Ticket Médio (Captado)", type: "calc", format: "currency", section: "kpis", formula: "Receita Captada ÷ Pedido Captado" },
  { key: "ticket_medio_pago", label: "Ticket Médio (Pago)", type: "calc", format: "currency", section: "kpis", formula: "Receita faturada ÷ Pedido Pago" },
  { key: "taxa_conversao_captado", label: "Taxa de conversão (Captado)", type: "calc", format: "percent", section: "kpis", formula: "Pedido Captado ÷ Sessões Totais" },
  { key: "taxa_conversao_pago", label: "Taxa de conversão (Pago)", type: "calc", format: "percent", section: "kpis", formula: "Pedido Pago ÷ Sessões Totais" },
  { key: "cps_geral", label: "CPS [Geral]", type: "calc", format: "currency", section: "kpis", formula: "Investimento total mídia+influ ÷ Sessões Totais" },
  { key: "cpa_geral", label: "CPA [Geral]", type: "calc", format: "currency", section: "kpis", formula: "Investimento total mídia+influ ÷ Pedido Captado" },
  { key: "roas_captado_loja", label: "ROAS [Captado Loja]", type: "calc", format: "number2", section: "kpis", formula: "Receita Captada ÷ Investimento total mídia+influ" },
  { key: "roas_pago_loja", label: "ROAS [Pago Loja]", type: "calc", format: "number2", section: "kpis", formula: "Você Recebe ÷ Investimento total mídia+influ" },
  { key: "pct_midia_captado", label: "% Em mídia [Captado]", type: "calc", format: "percent", section: "kpis", formula: "Investimento total mídia+influ ÷ Receita Captada" },
  { key: "pct_midia_pago", label: "% Em mídia [Pago]", type: "calc", format: "percent", section: "kpis", formula: "Investimento total mídia+influ ÷ Receita faturada" },
  { key: "share_participacao", label: "Share de participação", type: "input", format: "percent", section: "kpis" },
];

/* =========================
   Input metrics list (for API validation)
========================= */

export const YELLA_INPUT_METRICS: string[] = YELLA_PLANNING_ROWS
  .filter((r) => r.type === "input")
  .map((r) => r.key);

/* =========================
   Compute calculated values for a single month
========================= */

export function computeYellaMonth(inputs: MonthlyValues): MonthlyValues {
  const v = { ...inputs };
  const calc: MonthlyValues = {};

  // ─── Influencer aggregation ───
  let influ_inv = 0;
  let influ_fat = 0;
  let influ_vendas = 0;
  for (const inf of YELLA_INFLUENCERS) {
    const inv = v[`influ_${inf.slug}_investimento`] ?? 0;
    const fat = v[`influ_${inf.slug}_faturamento`] ?? 0;
    const ven = v[`influ_${inf.slug}_vendas`] ?? 0;
    influ_inv += inv;
    influ_fat += fat;
    influ_vendas += ven;

    // Per-influencer ROAS
    const roas = safeDiv(fat, inv);
    if (roas != null) calc[`influ_${inf.slug}_roas`] = Math.round(roas * 100) / 100;
  }

  // Influencer totals
  if (influ_inv > 0 || YELLA_INFLUENCERS.some(i => v[`influ_${i.slug}_investimento`] != null)) {
    calc.influ_investimento_total = Math.round(influ_inv * 100) / 100;
  }
  if (influ_fat > 0 || YELLA_INFLUENCERS.some(i => v[`influ_${i.slug}_faturamento`] != null)) {
    calc.influ_faturamento_total = Math.round(influ_fat * 100) / 100;
  }
  if (influ_vendas > 0 || YELLA_INFLUENCERS.some(i => v[`influ_${i.slug}_vendas`] != null)) {
    calc.influ_vendas_total = Math.round(influ_vendas);
  }
  const influ_roas = safeDiv(influ_fat, influ_inv);
  if (influ_roas != null) calc.influ_roas_total = Math.round(influ_roas * 100) / 100;

  // ─── Channel calcs ───
  const googleInv = v.google_ads ?? 0;
  const googleFat = v.google_ads_faturamento ?? 0;
  const metaInv = v.meta_ads ?? 0;
  const metaFat = v.meta_ads_faturamento ?? 0;

  // Google ADS ROAS
  const googleRoas = safeDiv(googleFat, googleInv);
  if (googleRoas != null) calc.google_ads_roas = Math.round(googleRoas * 100) / 100;

  // Meta ADS ROAS
  const metaRoas = safeDiv(metaFat, metaInv);
  if (metaRoas != null) calc.meta_ads_roas = Math.round(metaRoas * 100) / 100;

  // ─── Investment consolidation ───
  const investMidia = googleInv + metaInv;
  const fatMidia = googleFat + metaFat;
  const investTotal = investMidia + (calc.influ_investimento_total ?? influ_inv);
  const fatTotal = fatMidia + (calc.influ_faturamento_total ?? influ_fat);

  // Investimento total em mídia
  if (investMidia > 0 || v.google_ads != null || v.meta_ads != null) {
    calc.investimento_total_midia = Math.round(investMidia * 100) / 100;
  }
  if (fatMidia > 0 || v.google_ads_faturamento != null || v.meta_ads_faturamento != null) {
    calc.faturamento_total_midia = Math.round(fatMidia * 100) / 100;
  }
  const roasMidia = safeDiv(fatMidia, investMidia);
  if (roasMidia != null) calc.roas_total_midia = Math.round(roasMidia * 100) / 100;

  // Investimento total mídia + influ
  if (investTotal > 0 || investMidia > 0 || influ_inv > 0) {
    calc.investimento_total_midia_influ = Math.round(investTotal * 100) / 100;
  }
  if (fatTotal > 0 || fatMidia > 0 || influ_fat > 0) {
    calc.faturamento_total_midia_influ = Math.round(fatTotal * 100) / 100;
  }
  const roasTotal = safeDiv(fatTotal, investTotal);
  if (roasTotal != null) calc.roas_total_midia_influ = Math.round(roasTotal * 100) / 100;

  // ─── Receita & Custos ───
  // receita_faturada is INPUT (manual)

  // Lucro líquido = Você Recebe − Investimento total mídia+influ
  if (v.voce_recebe != null) {
    calc.lucro_liquido = Math.round((v.voce_recebe - investTotal) * 100) / 100;
  }

  // Taxa de aprovação = Você Recebe ÷ Receita Captada
  const taxaAprov = safeDiv(v.voce_recebe, v.receita_captada);
  if (taxaAprov != null) calc.taxa_aprovacao_pedidos = taxaAprov;

  // ─── Tráfego ───
  // Taxa de Engajamento = Sessões Engajadas ÷ Sessões Totais
  const taxaEng = safeDiv(v.sessoes_engajadas, v.sessoes_totais);
  if (taxaEng != null) calc.taxa_engajamento = taxaEng;

  // ─── Pedidos & Carrinhos ───
  const abandonados = v.carrinhos_abandonados ?? 0;
  const convertido = v.carrinhos_convertido ?? 0;
  const totalCarrinhos = abandonados + convertido;

  // Taxa de Abandono = Abandonados ÷ (Abandonados + Convertido)
  const taxaAbandono = safeDiv(abandonados, totalCarrinhos);
  if (taxaAbandono != null) calc.taxa_abandono_carrinho = taxaAbandono;

  // Taxa de conversão de Carrinho = Convertido ÷ Abandonados
  const taxaConvCarrinho = safeDiv(convertido, abandonados);
  if (taxaConvCarrinho != null) calc.taxa_conversao_carrinho = taxaConvCarrinho;

  // %Visitantes/Carrinho = Abandonados ÷ Visitantes
  const pctVisCarrinho = safeDiv(abandonados, v.usuarios_visitantes);
  if (pctVisCarrinho != null) calc.pct_visitantes_carrinho = pctVisCarrinho;

  // %Carrinho/Pedido = Pedido Captado ÷ (Abandonados + Convertido)
  const pctCarrPed = safeDiv(v.pedido_captado, totalCarrinhos);
  if (pctCarrPed != null) calc.pct_carrinho_pedido = pctCarrPed;

  // %Carrinho/Pedido Pago = Pedido Pago ÷ (Abandonados + Convertido)
  const pctCarrPedPago = safeDiv(v.pedido_pago, totalCarrinhos);
  if (pctCarrPedPago != null) calc.pct_carrinho_pedido_pago = pctCarrPedPago;

  // ─── KPIs Finais ───
  // Ticket Médio (Captado) = Receita Captada ÷ Pedido Captado
  calc.ticket_medio_captado = safeDiv(v.receita_captada, v.pedido_captado) ?? undefined;

  // Ticket Médio (Pago) = Receita faturada ÷ Pedido Pago
  const recFaturada = v.receita_faturada ?? 0;
  if (recFaturada > 0) {
    calc.ticket_medio_pago = safeDiv(recFaturada, v.pedido_pago) ?? undefined;
  }

  // Taxa de conversão (Captado) = Pedido Captado ÷ Sessões Totais
  calc.taxa_conversao_captado = safeDiv(v.pedido_captado, v.sessoes_totais) ?? undefined;

  // Taxa de conversão (Pago) = Pedido Pago ÷ Sessões Totais
  calc.taxa_conversao_pago = safeDiv(v.pedido_pago, v.sessoes_totais) ?? undefined;

  // CPS [Geral] = Investimento total mídia+influ ÷ Sessões Totais
  calc.cps_geral = safeDiv(investTotal, v.sessoes_totais) ?? undefined;

  // CPA [Geral] = Investimento total mídia+influ ÷ Pedido Captado
  calc.cpa_geral = safeDiv(investTotal, v.pedido_captado) ?? undefined;

  // ROAS [Captado Loja] = Receita Captada ÷ Investimento total mídia+influ
  calc.roas_captado_loja = safeDiv(v.receita_captada, investTotal) ?? undefined;

  // ROAS [Pago Loja] = Você Recebe ÷ Investimento total mídia+influ
  calc.roas_pago_loja = safeDiv(v.voce_recebe, investTotal) ?? undefined;

  // % Em mídia [Captado] = Investimento total mídia+influ ÷ Receita Captada
  calc.pct_midia_captado = safeDiv(investTotal, v.receita_captada) ?? undefined;

  // % Em mídia [Pago] = Investimento total mídia+influ ÷ Receita faturada
  if (recFaturada > 0) {
    calc.pct_midia_pago = safeDiv(investTotal, recFaturada) ?? undefined;
  }

  return calc;
}

/* =========================
   Compute the TOTAL column (annual aggregation)
========================= */

export function computeYellaTotals(yearData: PlanningYearData): MonthlyValues {
  const totals: MonthlyValues = {};
  const inputKeys = YELLA_PLANNING_ROWS.filter((r) => r.type === "input").map((r) => r.key);
  const pctInputs = new Set(["taxa_rejeicao", "share_participacao"]);

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

  // Average for percentage inputs
  for (const [key, { sum, count }] of Object.entries(pctSums)) {
    if (count > 0) totals[key] = sum / count;
  }

  // Compute calculated metrics on summed totals
  const calc = computeYellaMonth(totals);
  return { ...totals, ...calc };
}

/* =========================
   Compute all months + totals for a full year
========================= */

export function computeYellaFullYear(
  yearData: PlanningYearData
): { months: Record<number, MonthlyValues>; totals: MonthlyValues } {
  const months: Record<number, MonthlyValues> = {};

  for (let m = 1; m <= 12; m++) {
    const inputs = yearData[m] ?? {};
    const calc = computeYellaMonth(inputs);
    months[m] = { ...inputs, ...calc };
  }

  const totals = computeYellaTotals(yearData);
  return { months, totals };
}
