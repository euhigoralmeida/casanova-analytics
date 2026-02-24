import type {
  ScoredKeyword,
  ScoredPage,
  CannibalizationEntry,
  StrategicDecision,
  EffortLevel,
  UrgencyLevel,
  OrganicStrategyResponse,
} from "./organic-types";
import { estimateImpactBRL } from "./organic-scoring";

/* =========================
   Strategy Generator — 8 templates, selects top 5 by impact
========================= */

type StrategyContext = {
  keywords: ScoredKeyword[];
  pages: ScoredPage[];
  cannibalization: CannibalizationEntry[];
  avgTicket: number;
  organicConvRate: number;
  organicRevenue: number;
  totalRevenue: number;
};

function generateAllDecisions(ctx: StrategyContext): StrategicDecision[] {
  const decisions: StrategicDecision[] = [];

  // 1. Escalar keyword — top keywords com posicao 4-20
  const scaleKws = ctx.keywords
    .filter((k) => k.classification === "escalar" && k.position >= 4 && k.position <= 20)
    .slice(0, 3);

  for (const kw of scaleKws) {
    const impact = kw.estimatedImpactBRL;
    if (impact < 10) continue;
    decisions.push({
      id: `scale-kw-${kw.query.replace(/\s+/g, "-").slice(0, 30)}`,
      action: `Escalar keyword "${kw.query}" (posicao ${kw.position.toFixed(0)})`,
      detail: `Keyword com score ${kw.score}/100 e ${kw.impressions.toLocaleString("pt-BR")} impressoes. Otimizar conteudo da landing page, melhorar title/meta description, e adicionar internal links para subir ranking.`,
      estimatedImpactBRL: impact,
      effort: kw.position <= 10 ? "baixo" : "medio" as EffortLevel,
      urgency: impact > 500 ? "esta_semana" : "este_mes" as UrgencyLevel,
      metricsToWatch: ["posicao media", "CTR organico", "cliques organicos"],
      antiRecommendation: "Nao mudar URL da pagina — isso reseta a autoridade do Google.",
      connectionToPaid: `Verificar se esta keyword esta sendo comprada no Google Ads. Se sim, considerar reduzir lance.`,
      connectionToCRO: `Verificar taxa de conversao da landing page. Se abaixo da media, priorizar CRO antes de SEO.`,
    });
  }

  // 2. Economia canibalizacao
  const fullCannibals = ctx.cannibalization
    .filter((c) => c.type === "full_cannibal" && c.estimatedSavingsBRL > 20)
    .slice(0, 2);

  for (const c of fullCannibals) {
    decisions.push({
      id: `cannibal-save-${c.keyword.replace(/\s+/g, "-").slice(0, 30)}`,
      action: `Reduzir gasto pago em "${c.keyword}" (posicao organica ${c.organicPosition.toFixed(0)})`,
      detail: `Keyword ja ranqueia no top-3 organico com ${c.organicClicks} cliques. Pago gastou R$ ${c.paidCostBRL.toFixed(2)} competindo pela mesma keyword. Reduzir ou pausar lance pago.`,
      estimatedImpactBRL: c.estimatedSavingsBRL,
      effort: "baixo",
      urgency: c.estimatedSavingsBRL > 200 ? "imediata" : "esta_semana",
      metricsToWatch: ["custo Google Ads", "impressoes organicas", "posicao organica"],
      antiRecommendation: "Nao pausar completamente de uma vez — reduzir gradualmente e monitorar.",
      connectionToPaid: `Economia direta de R$ ${c.estimatedSavingsBRL.toFixed(2)}/periodo no Google Ads.`,
      connectionToCRO: `Liberar budget pago para keywords de CRO com baixa conversao organica.`,
    });
  }

  // 3. Fix CRO de pagina — alto trafego organico com baixa conversao
  const croPages = ctx.pages
    .filter((p) => p.issues.includes("high_traffic_low_conv") && p.clicks > 30)
    .slice(0, 2);

  for (const page of croPages) {
    const potentialRevenue = page.clicks * ctx.organicConvRate * ctx.avgTicket;
    const currentRevenue = page.revenue;
    const impact = Math.round(Math.max(0, potentialRevenue - currentRevenue) * 100) / 100;
    if (impact < 10) continue;

    decisions.push({
      id: `cro-fix-${page.path.replace(/\//g, "-").slice(0, 30)}`,
      action: `CRO na pagina ${page.path} (${page.clicks} cliques org, ${page.convRate.toFixed(1)}% conv)`,
      detail: `Pagina recebe ${page.clicks} cliques organicos mas converte apenas ${page.convRate.toFixed(1)}% (media do site: ${(ctx.organicConvRate * 100).toFixed(1)}%). Otimizar CTA, imagens, e fluxo de add-to-cart.`,
      estimatedImpactBRL: impact,
      effort: "medio",
      urgency: "esta_semana",
      metricsToWatch: ["taxa conversao pagina", "add-to-cart rate", "bounce rate"],
      antiRecommendation: "Nao alterar titulo H1/meta que esta ranqueando bem — foque em elementos de conversao.",
      connectionToPaid: `Se esta pagina recebe trafego pago, o impacto do CRO sera multiplicado.`,
      connectionToCRO: `Acao direta de CRO — priorizar teste A/B de CTA e layout.`,
    });
  }

  // 4. Recuperar posicao
  const recoverKws = ctx.keywords
    .filter((k) => k.classification === "recuperar" && (k.deltaPosition ?? 0) < -3)
    .slice(0, 2);

  for (const kw of recoverKws) {
    const drop = Math.abs(kw.deltaPosition ?? 0);
    const impact = estimateImpactBRL(
      kw.impressions,
      kw.position,
      Math.max(1, kw.position - drop),
      ctx.organicConvRate,
      ctx.avgTicket,
      0.30,
    );
    if (impact < 10) continue;

    decisions.push({
      id: `recover-${kw.query.replace(/\s+/g, "-").slice(0, 30)}`,
      action: `Recuperar posicao de "${kw.query}" (caiu ${drop.toFixed(1)} posicoes)`,
      detail: `Keyword caiu de posicao ${(kw.position - drop).toFixed(0)} para ${kw.position.toFixed(0)}. Investigar: conteudo desatualizado, concorrente novo, ou link perdido.`,
      estimatedImpactBRL: impact,
      effort: "medio",
      urgency: "esta_semana",
      metricsToWatch: ["posicao media", "cliques organicos", "impressoes"],
      antiRecommendation: "Nao fazer mudancas drasticas de conteudo — primeiro diagnosticar a causa.",
      connectionToPaid: `Considerar aumentar lance pago temporariamente enquanto recupera posicao organica.`,
      connectionToCRO: `Verificar se mudancas no site (layout, velocidade) causaram a queda.`,
    });
  }

  // 5. Dominio duplo
  const dualDominance = ctx.cannibalization
    .filter((c) => c.type === "dual_dominance" && c.paidRevenue > 100)
    .slice(0, 1);

  for (const c of dualDominance) {
    const combinedValue = c.paidRevenue + c.organicClicks * ctx.organicConvRate * ctx.avgTicket;
    decisions.push({
      id: `dual-${c.keyword.replace(/\s+/g, "-").slice(0, 30)}`,
      action: `Manter dominio duplo em "${c.keyword}"`,
      detail: `Keyword aparece no organico (pos ${c.organicPosition.toFixed(0)}) E no pago. Ambos geram valor: R$ ${c.paidRevenue.toFixed(2)} pago + trafego organico. Estrategia de dominio da SERP.`,
      estimatedImpactBRL: Math.round(combinedValue * 0.1 * 100) / 100,
      effort: "baixo",
      urgency: "este_mes",
      metricsToWatch: ["share of SERP", "CTR combinado", "custo por dominio"],
      antiRecommendation: "Nao pausar nenhum dos dois canais sem testar o impacto isolado.",
      connectionToPaid: `Manter investimento pago como seguranca enquanto organico consolida.`,
      connectionToCRO: `Garantir que a landing page esta otimizada para ambos os canais.`,
    });
  }

  // 6. Alinhar estoque
  const noStockKws = ctx.keywords
    .filter((k) => k.score >= 50 && k.clicks > 10)
    .slice(0, 1); // Would need hasStock=false, placeholder for now

  // 7. Gap de conteudo — high impressions, low CTR
  const gapPages = ctx.pages
    .filter((p) => p.issues.includes("unexploited") && p.impressions > 200)
    .slice(0, 2);

  for (const page of gapPages) {
    const impact = estimateImpactBRL(
      page.impressions,
      page.position,
      Math.max(1, page.position - 2),
      ctx.organicConvRate,
      ctx.avgTicket,
      0.30,
    );
    if (impact < 10) continue;

    decisions.push({
      id: `gap-${page.path.replace(/\//g, "-").slice(0, 30)}`,
      action: `Otimizar title/meta de ${page.path} (CTR ${(page.ctr * 100).toFixed(1)}% vs esperado)`,
      detail: `Pagina tem ${page.impressions.toLocaleString("pt-BR")} impressoes mas CTR abaixo do esperado. Reescrever title tag e meta description para aumentar cliques.`,
      estimatedImpactBRL: impact,
      effort: "baixo",
      urgency: "esta_semana",
      metricsToWatch: ["CTR", "cliques organicos", "posicao media"],
      antiRecommendation: "Manter a keyword principal no title — nao usar clickbait que nao entrega.",
      connectionToPaid: `Usar os textos que funcionam nos anuncios pagos como inspiracao para o title/meta.`,
      connectionToCRO: `CTR maior = mais trafego na mesma posicao — impacto direto no topo do funil.`,
    });
  }

  // 8. Otimizar CTR (keywords com CTR abaixo do esperado)
  const lowCtrKws = ctx.keywords
    .filter((k) => k.deltaCtr !== undefined && k.deltaCtr < -0.03 && k.impressions > 200 && k.position <= 10)
    .slice(0, 2);

  for (const kw of lowCtrKws) {
    // For CTR optimization, estimate differently
    const expectedCtrDiff = Math.abs(kw.deltaCtr ?? 0);
    const extraClicks = kw.impressions * expectedCtrDiff;
    const ctrImpact = Math.round(extraClicks * ctx.organicConvRate * ctx.avgTicket * 0.30 * 100) / 100;
    if (ctrImpact < 10) continue;

    decisions.push({
      id: `ctr-opt-${kw.query.replace(/\s+/g, "-").slice(0, 30)}`,
      action: `Otimizar CTR de "${kw.query}" (${(kw.ctr * 100).toFixed(1)}% atual)`,
      detail: `Keyword na posicao ${kw.position.toFixed(0)} com CTR ${(kw.ctr * 100).toFixed(1)}% — esperado para esta posicao seria maior. Melhorar title, meta description e rich snippets.`,
      estimatedImpactBRL: ctrImpact,
      effort: "baixo",
      urgency: "este_mes",
      metricsToWatch: ["CTR", "cliques organicos"],
      antiRecommendation: "Nao alterar URL ou estrutura da pagina — apenas title/meta/schema.",
      connectionToPaid: `Comparar headlines dos anuncios pagos para esta keyword — usar as que convertem.`,
      connectionToCRO: `Mais cliques = mais trafego para converter. Garantir que CRO da pagina esta ok.`,
    });
  }

  // Suppress placeholder
  void noStockKws;

  return decisions;
}

/* =========================
   Public API
========================= */

export function generateOrganicStrategy(ctx: StrategyContext): OrganicStrategyResponse {
  const allDecisions = generateAllDecisions(ctx);

  // Sort by impact and take top 5
  allDecisions.sort((a, b) => b.estimatedImpactBRL - a.estimatedImpactBRL);
  const top5 = allDecisions.slice(0, 5);

  // Calculate summary
  const totalImpact = top5.reduce((s, d) => s + d.estimatedImpactBRL, 0);
  const totalSavings = ctx.cannibalization
    .filter((c) => c.type === "full_cannibal")
    .reduce((s, c) => s + c.estimatedSavingsBRL, 0);

  // Growth potential: sum of all "escalar" keyword impacts
  const growthPotential = ctx.keywords
    .filter((k) => k.classification === "escalar")
    .reduce((s, k) => s + k.estimatedImpactBRL, 0);

  return {
    source: "computed",
    updatedAt: new Date().toISOString(),
    decisions: top5,
    summary: {
      totalImpactBRL: Math.round(totalImpact * 100) / 100,
      totalSavingsBRL: Math.round(totalSavings * 100) / 100,
      growthPotentialBRL: Math.round(growthPotential * 100) / 100,
    },
  };
}
