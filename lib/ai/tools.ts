// Tool definitions for Claude function calling

import type Anthropic from "@anthropic-ai/sdk";

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_account_metrics",
    description:
      "Métricas agregadas da conta Google Ads: receita, investimento (ads), ROAS, CPA, impressões, cliques, conversões, CTR.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_sku_metrics",
    description:
      "Métricas de SKUs. Sem parâmetro sku retorna todos. Com sku retorna um específico. Inclui: receita, ads, ROAS, CPA, impressões, cliques, conversões.",
    input_schema: {
      type: "object" as const,
      properties: {
        sku: { type: "string", description: "ID do SKU (opcional — sem ele retorna todos)" },
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_campaign_metrics",
    description:
      "Métricas por campanha Google Ads: nome, tipo, status, ROAS, CPA, receita, custo, impressões, cliques, conversões.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_segmentation",
    description:
      "Métricas por segmento: dispositivo (desktop/mobile/tablet), faixa etária, gênero ou região geográfica. Inclui ROAS, CPA, receita, custo por segmento.",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: {
          type: "string",
          enum: ["device", "age", "gender", "geographic"],
          description: "Tipo de segmentação",
        },
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["segment", "startDate", "endDate"],
    },
  },
  {
    name: "get_ga4_funnel",
    description:
      "Funil e-commerce GA4: sessões, add to cart, checkout, purchase. Inclui taxa de abandono e taxa de conversão geral.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_channel_acquisition",
    description:
      "Aquisição por canal GA4: orgânico, pago, direto, social, email, referral. Sessões, usuários, conversões, receita por canal.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_planning_targets",
    description:
      "Metas do planejamento mensal: receita, ROAS, CPA, sessões, pedidos, ticket médio, etc. Retorna metas definidas no planejamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Ano (ex: 2026)" },
        month: { type: "number", description: "Mês (1-12)" },
      },
      required: ["year", "month"],
    },
  },
  {
    name: "get_timeseries",
    description:
      "Série temporal diária: receita, custo, impressões, cliques, conversões. Escopo: account (toda a conta) ou sku (um SKU específico).",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", enum: ["account", "sku"], description: "Escopo: conta inteira ou SKU" },
        id: { type: "string", description: "ID do SKU (obrigatório se scope=sku)" },
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["scope", "startDate", "endDate"],
    },
  },
  {
    name: "get_cognitive_analysis",
    description:
      "Análise cognitiva completa do motor de regras: findings priorizados, modo estratégico, gargalo principal, pacing de metas, health score, executive summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início yyyy-mm-dd" },
        endDate: { type: "string", description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "compare_periods",
    description:
      "Compara métricas da conta entre dois períodos. Retorna métricas de ambos os períodos + variação percentual.",
    input_schema: {
      type: "object" as const,
      properties: {
        period1Start: { type: "string", description: "Início do período 1 yyyy-mm-dd" },
        period1End: { type: "string", description: "Fim do período 1 yyyy-mm-dd" },
        period2Start: { type: "string", description: "Início do período 2 yyyy-mm-dd" },
        period2End: { type: "string", description: "Fim do período 2 yyyy-mm-dd" },
      },
      required: ["period1Start", "period1End", "period2Start", "period2End"],
    },
  },
];
