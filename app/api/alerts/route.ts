import { NextRequest, NextResponse } from "next/server";
import { getCustomerAsync, computeComparisonDates } from "@/lib/google-ads";
import { getGA4ClientAsync } from "@/lib/google-analytics";
import { fetchAccountTotals, fetchAllCampaignMetrics, fetchAllSkuMetrics, fetchAccountTimeSeries } from "@/lib/queries";
import { fetchRetentionSummary } from "@/lib/ga4-queries";
import { computeAllSmartAlerts } from "@/lib/alert-engine";
import type { SmartAlert, SmartAlertsResponse } from "@/lib/alert-types";
import { requireAuthWithRateLimit, requireTenantContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

/* =========================
   Mock fallback
========================= */

function buildMockAlerts(): SmartAlert[] {
  return [
    {
      id: "acct-roas-drop",
      category: "account",
      severity: "danger",
      title: "ROAS da conta caiu 22% vs período anterior",
      description: "ROAS atual: 5.8 vs anterior: 7.4.",
      metric: "ROAS",
      currentValue: 5.8,
      previousValue: 7.4,
      deltaPct: -22,
      recommendation: "Revise as campanhas com pior desempenho e considere pausar as de ROAS mais baixo",
    },
    {
      id: "camp-2-cpa-spike",
      category: "campaign",
      severity: "warn",
      title: "Campanha 'PMax - Metais Sanitários': CPA subiu 28%",
      description: "CPA atual: R$31,10 vs anterior: R$24,30.",
      metric: "CPA",
      currentValue: 31.1,
      previousValue: 24.3,
      deltaPct: 28,
      entityName: "PMax - Metais Sanitários",
      entityId: "2",
      recommendation: "Avalie negativar termos de busca ou ajustar público-alvo",
    },
    {
      id: "sku-31450BR-LX-zero-conv",
      category: "sku",
      severity: "danger",
      title: "SKU 31450BR-LX: gastou R$93,33 sem nenhuma venda",
      description: "45 cliques mas nenhuma conversão no período.",
      metric: "conversions",
      currentValue: 0,
      previousValue: 1.5,
      deltaPct: -100,
      entityName: "31450BR-LX",
      entityId: "31450BR-LX",
      recommendation: "Pause anúncios deste SKU ou revise a página do produto",
    },
    {
      id: "trend-roas-decline",
      category: "trend",
      severity: "warn",
      title: "ROAS em queda há 4 dias consecutivos",
      description: "Tendência negativa detectada nos últimos dias da série.",
      metric: "ROAS",
      currentValue: 4.2,
      previousValue: 6.1,
      deltaPct: 0,
      recommendation: "Revise campanhas e SKUs antes que a situação piore",
    },
    {
      id: "sku-27290BR-CP-roas-up",
      category: "sku",
      severity: "success",
      title: "SKU 27290BR-CP: ROAS subiu 18% — desempenho excelente",
      description: "ROAS atual: 8.2 vs anterior: 6.9.",
      metric: "ROAS",
      currentValue: 8.2,
      previousValue: 6.9,
      deltaPct: 18,
      entityName: "27290BR-CP",
      entityId: "27290BR-CP",
      recommendation: "Considere aumentar o orçamento para este SKU",
    },
    {
      id: "acct-spend-stable",
      category: "account",
      severity: "info",
      title: "Gasto total estável (+3% vs período anterior)",
      description: "Gasto atual: R$1.260,21 vs anterior: R$1.223,50.",
      metric: "spend",
      currentValue: 1260.21,
      previousValue: 1223.5,
      deltaPct: 3,
    },
    {
      id: "ret-return-rate-warn",
      category: "retention",
      severity: "warn",
      title: "Taxa de retorno abaixo do ideal",
      description: "Taxa de retorno de 18.5% — ideal é acima de 25%.",
      metric: "return_rate",
      currentValue: 18.5,
      previousValue: 0,
      deltaPct: 0,
      recommendation: "Considere campanhas de reativação para usuários inativos",
    },
  ];
}

/* =========================
   GET handler
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuthWithRateLimit(request);
  if ("error" in auth) return auth.error;
  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  // Precisamos de startDate/endDate para calcular período anterior
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const { prevStart, prevEnd } = computeComparisonDates(startDate, endDate);

  /* ---- DADOS REAIS (Google Ads) ---- */
  try {
    const customer = await getCustomerAsync(tenantId);
    if (!customer) {
      return NextResponse.json({
        period,
        source: "not_configured",
        updatedAt: new Date().toISOString(),
        currentPeriod: { start: startDate, end: endDate },
        previousPeriod: { start: prevStart, end: prevEnd },
        alerts: [],
        summary: { total: 0, danger: 0, warn: 0, info: 0, success: 0 },
      } satisfies SmartAlertsResponse);
    }

    const [
      currentAccount,
      previousAccount,
      currentCampaigns,
      previousCampaigns,
      currentSkus,
      previousSkus,
      dailyTimeSeries,
    ] = await Promise.all([
      fetchAccountTotals(customer, period, startDate, endDate, tenantId),
      fetchAccountTotals(customer, "custom", prevStart, prevEnd, tenantId),
      fetchAllCampaignMetrics(customer, period, startDate, endDate, tenantId),
      fetchAllCampaignMetrics(customer, "custom", prevStart, prevEnd, tenantId),
      fetchAllSkuMetrics(customer, period, startDate, endDate, tenantId),
      fetchAllSkuMetrics(customer, "custom", prevStart, prevEnd, tenantId),
      fetchAccountTimeSeries(customer, period, startDate, endDate, tenantId),
    ]);

    // Fetch retention data from GA4
    const retentionSummary = await getGA4ClientAsync(tenantId)
      .then((ga4Client) => ga4Client ? fetchRetentionSummary(ga4Client, startDate, endDate, tenantId) : undefined)
      .catch((err) => {
        logger.error("GA4 retention fetch failed for alerts", { route: "/api/alerts", tenantId }, err);
        return undefined;
      });

      const alerts = computeAllSmartAlerts(
        currentAccount,
        previousAccount,
        currentCampaigns,
        previousCampaigns,
        currentSkus,
        previousSkus,
        dailyTimeSeries,
        retentionSummary,
      );

      const summary = {
        total: alerts.length,
        danger: alerts.filter((a) => a.severity === "danger").length,
        warn: alerts.filter((a) => a.severity === "warn").length,
        info: alerts.filter((a) => a.severity === "info").length,
        success: alerts.filter((a) => a.severity === "success").length,
      };

      const response: SmartAlertsResponse = {
        period,
        source: "google-ads",
        updatedAt: new Date().toISOString(),
        currentPeriod: { start: startDate, end: endDate },
        previousPeriod: { start: prevStart, end: prevEnd },
        alerts,
        summary,
      };

      return NextResponse.json(response);
  } catch (err) {
    logger.error("Google Ads API error in alerts, falling back to mock", { route: "/api/alerts", tenantId }, err);
  }

  /* ---- MOCK (fallback) ---- */
  const mockAlerts = buildMockAlerts();
  const summary = {
    total: mockAlerts.length,
    danger: mockAlerts.filter((a) => a.severity === "danger").length,
    warn: mockAlerts.filter((a) => a.severity === "warn").length,
    info: mockAlerts.filter((a) => a.severity === "info").length,
    success: mockAlerts.filter((a) => a.severity === "success").length,
  };

  return NextResponse.json({
    period,
    source: "mock",
    updatedAt: new Date().toISOString(),
    currentPeriod: { start: startDate, end: endDate },
    previousPeriod: { start: prevStart, end: prevEnd },
    alerts: mockAlerts,
    summary,
  } satisfies SmartAlertsResponse);
}
