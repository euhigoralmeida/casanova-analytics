// Tool definitions for Google Gemini function calling

import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

export const GEMINI_TOOLS: FunctionDeclaration[] = [
  {
    name: "get_account_metrics",
    description:
      "Métricas agregadas da conta Google Ads: receita, investimento (ads), ROAS, CPA, impressões, cliques, conversões, CTR.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_sku_metrics",
    description:
      "Métricas de SKUs. Sem parâmetro sku retorna todos. Com sku retorna um específico. Inclui: receita, ads, ROAS, CPA, impressões, cliques, conversões.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sku: { type: SchemaType.STRING, description: "ID do SKU (opcional — sem ele retorna todos)" },
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_campaign_metrics",
    description:
      "Métricas por campanha Google Ads: nome, tipo, status, ROAS, CPA, receita, custo, impressões, cliques, conversões.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_segmentation",
    description:
      "Métricas por segmento: dispositivo (desktop/mobile/tablet), faixa etária, gênero ou região geográfica. Inclui ROAS, CPA, receita, custo por segmento.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        segment: {
          type: SchemaType.STRING,
          description: "Tipo de segmentação: device, age, gender ou geographic",
        },
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["segment", "startDate", "endDate"],
    },
  },
  {
    name: "get_ga4_funnel",
    description:
      "Funil e-commerce GA4: sessões, add to cart, checkout, purchase. Inclui taxa de abandono e taxa de conversão geral.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_channel_acquisition",
    description:
      "Aquisição por canal GA4: orgânico, pago, direto, social, email, referral. Sessões, usuários, conversões, receita por canal.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_planning_targets",
    description:
      "Metas do planejamento mensal: receita, ROAS, CPA, sessões, pedidos, ticket médio, etc.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: { type: SchemaType.NUMBER, description: "Ano (ex: 2026)" },
        month: { type: SchemaType.NUMBER, description: "Mês (1-12)" },
      },
      required: ["year", "month"],
    },
  },
  {
    name: "get_timeseries",
    description:
      "Série temporal diária: receita, custo, impressões, cliques, conversões. Escopo: account (toda a conta) ou sku (um SKU específico).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        scope: { type: SchemaType.STRING, description: "Escopo: account ou sku" },
        id: { type: SchemaType.STRING, description: "ID do SKU (obrigatório se scope=sku)" },
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["scope", "startDate", "endDate"],
    },
  },
  {
    name: "get_cognitive_analysis",
    description:
      "Análise cognitiva completa: findings priorizados, modo estratégico, gargalo principal, pacing de metas, health score.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_retention_metrics",
    description:
      "Métricas de retenção GA4: novos vs retornantes, taxa de retorno, LTV por canal, cohort analysis semanal.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: "Data início yyyy-mm-dd" },
        endDate: { type: SchemaType.STRING, description: "Data fim yyyy-mm-dd" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "compare_periods",
    description:
      "Compara métricas da conta entre dois períodos. Retorna métricas de ambos + variação percentual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period1Start: { type: SchemaType.STRING, description: "Início do período 1 yyyy-mm-dd" },
        period1End: { type: SchemaType.STRING, description: "Fim do período 1 yyyy-mm-dd" },
        period2Start: { type: SchemaType.STRING, description: "Início do período 2 yyyy-mm-dd" },
        period2End: { type: SchemaType.STRING, description: "Fim do período 2 yyyy-mm-dd" },
      },
      required: ["period1Start", "period1End", "period2Start", "period2End"],
    },
  },
];
