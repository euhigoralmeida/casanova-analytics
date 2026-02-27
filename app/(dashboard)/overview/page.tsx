"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, OverviewResponse, SmartAlertsResponse, TimeSeriesResponse, GA4DataResponse, RetentionData } from "@/types/api";
import { useDateRange } from "@/hooks/use-date-range";
import type { IntelligenceResponse } from "@/lib/intelligence/types";
import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import ChartsSection from "@/components/charts/charts-section";
import Kpi from "@/components/ui/kpi-card";
import { KpiSkeleton, AlertsSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { BudgetPlanCard } from "@/components/intelligence/budget-plan-card";
import { SegmentationSummary } from "@/components/intelligence/segmentation-summary";
import { StrategicAdvisorCard } from "@/components/intelligence/strategic-advisor-card";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { exportToCSV } from "@/lib/export-csv";
import { RefreshCw, Download } from "lucide-react";
import { EmptyIntegrationState } from "@/components/ui/empty-integration-state";

export default function VisaoGeralPage() {
  const { dateRange, setDateRange, buildParams } = useDateRange();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [, setSmartAlerts] = useState<SmartAlertsResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResponse & Partial<CognitiveResponse> | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const { label: updatedLabel, markUpdated } = useLastUpdated();

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    setSectionErrors([]);
    try {
      const base = buildParams(range);
      const errors: string[] = [];

      const [overviewRes, alertsRes, tsRes, ga4Res, intelRes, retentionRes] = await Promise.all([
        fetch(`/api/overview?${base}`),
        fetch(`/api/alerts?${base}`).catch(() => null),
        fetch(`/api/timeseries?${buildParams(range, { scope: "account" })}`).catch(() => null),
        fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).catch(() => null),
        fetch(`/api/intelligence?${base}`).catch(() => null),
        fetch(`/api/retention?startDate=${range.startDate}&endDate=${range.endDate}`).catch(() => null),
      ]);

      if (!overviewRes.ok) throw new Error("Erro ao carregar dados");
      setOverview(await overviewRes.json());
      if (alertsRes?.ok) setSmartAlerts(await alertsRes.json()); else if (alertsRes) errors.push("Alertas");
      if (tsRes?.ok) setTimeseries(await tsRes.json()); else if (tsRes) errors.push("Gráficos");
      if (ga4Res?.ok) setGa4Data(await ga4Res.json()); else if (ga4Res) errors.push("GA4");
      if (intelRes?.ok) setIntelligence(await intelRes.json()); else if (intelRes) errors.push("Inteligência");
      if (retentionRes?.ok) setRetention(await retentionRes.json()); else if (retentionRes) errors.push("Retenção");
      if (errors.length > 0) setSectionErrors(errors);
      markUpdated();
    } catch {
      setError("Erro ao carregar dados. Tente novamente ou aguarde alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, [buildParams, markUpdated]);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  const acct = overview?.accountTotals;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">

      {/* ─── ROW 1: Header — título + date picker + refresh ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Visão Geral</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {overview && overview.source !== "google-ads" && overview.source !== "not_configured" && (
              <span className="ml-2 text-zinc-400">Dados mock</span>
            )}
            {updatedLabel && !loading && (
              <span className="ml-2 text-zinc-400">· {updatedLabel}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overview && acct && (
            <button
              onClick={() => {
                const kpis = [{
                  metrica: "Receita",
                  valor: acct.revenue,
                  conversoes: Math.round(acct.conversions * 100) / 100,
                  investimento: acct.ads,
                  roas: overview.meta.roasActual,
                  cliques: acct.clicks,
                }];
                exportToCSV(kpis, [
                  { key: "metrica", label: "Métrica" },
                  { key: "valor", label: "Receita" },
                  { key: "conversoes", label: "Conversões" },
                  { key: "investimento", label: "Investimento" },
                  { key: "roas", label: "ROAS" },
                  { key: "cliques", label: "Cliques" },
                ], `overview-${dateRange.startDate}-${dateRange.endDate}.csv`);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-white transition-colors"
              title="Exportar CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
          <button
            onClick={() => loadData(dateRange)}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-700 disabled:opacity-30 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
        </div>
      </div>

      {/* ─── ERRO ─── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ─── ERROS PARCIAIS ─── */}
      {sectionErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Alguns dados não carregaram: <strong>{sectionErrors.join(", ")}</strong>. As demais seções estão disponíveis.
          </p>
        </div>
      )}

      {/* ─── LOADING ─── */}
      {loading && !overview && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
          <AlertsSkeleton />
          <ChartSkeleton />
        </>
      )}

      {/* ─── NÃO CONFIGURADO ─── */}
      {overview && overview.source === "not_configured" && !loading && (
        <EmptyIntegrationState
          platform="Google Ads"
          showWelcome
          message="Configure suas integrações para começar a ver dados do seu e-commerce. Comece conectando o Google Ads nas configurações."
        />
      )}

      {/* ─── ROW 2: KPI Cards ─── */}
      {overview && overview.source !== "not_configured" && acct && !loading && (() => {
        const ltvValue = retention?.summary
          ? (retention.summary.purchasers > 0 ? retention.summary.revenue / retention.summary.purchasers : 0)
          : null;
        const conversions = Math.round(acct.conversions * 100) / 100;
        const ticketMedio = conversions > 0 ? Math.round((acct.revenue / conversions) * 100) / 100 : 0;
        const pedidosTarget = overview.meta.pedidosCaptadosTarget ?? 0;
        const ticketTarget = overview.meta.ticketMedioTarget ?? 0;
        const returnRate = retention?.summary?.returnRate ?? 0;
        return (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <Kpi
              title="Receita"
              value={formatBRL(acct.revenue)}
              subtitle={`${conversions.toLocaleString("pt-BR")} conversões`}
              progress={
                overview.meta.revenueCaptadaTarget
                  ? { actual: acct.revenue, target: overview.meta.revenueCaptadaTarget, format: (v) => formatBRL(v) }
                  : overview.meta.revenueTarget > 0
                    ? { actual: acct.revenue, target: overview.meta.revenueTarget, format: (v) => formatBRL(v) }
                    : undefined
              }
            />
            <Kpi
              title="Investimento"
              value={formatBRL(acct.ads)}
              subtitle={`${acct.clicks.toLocaleString("pt-BR")} cliques`}
              progress={
                overview.meta.adsTarget
                  ? { actual: overview.meta.adsActual ?? acct.ads, target: overview.meta.adsTarget, format: (v) => formatBRL(v) }
                  : undefined
              }
            />
            <Kpi
              title="ROAS"
              value={overview.meta.roasActual.toFixed(1)}
              subtitle={`Meta: ${overview.meta.roasTarget.toFixed(1)}`}
              progress={{ actual: overview.meta.roasActual, target: overview.meta.roasTarget, format: (v) => v.toFixed(1) }}
            />
            <Kpi
              title="Pedidos Captados"
              value={conversions.toLocaleString("pt-BR")}
              subtitle={pedidosTarget > 0 ? `Meta: ${Math.round(pedidosTarget).toLocaleString("pt-BR")}` : `CTR: ${acct.impressions > 0 ? ((acct.clicks / acct.impressions) * 100).toFixed(2) : 0}%`}
              progress={
                pedidosTarget > 0
                  ? { actual: conversions, target: pedidosTarget, format: (v) => Math.round(v).toLocaleString("pt-BR") }
                  : undefined
              }
            />
            <Kpi
              title="Ticket Médio"
              value={formatBRL(ticketMedio)}
              subtitle={ticketTarget > 0 ? `Meta: ${formatBRL(ticketTarget)}` : `${conversions.toLocaleString("pt-BR")} pedidos`}
              progress={
                ticketTarget > 0
                  ? { actual: ticketMedio, target: ticketTarget, format: (v) => formatBRL(v) }
                  : undefined
              }
            />
            <Kpi
              title="LTV Médio"
              value={ltvValue !== null ? formatBRL(ltvValue) : "—"}
              subtitle={retention?.summary
                ? `Taxa retorno: ${returnRate.toFixed(1).replace(".", ",")}% · ${retention.summary.purchasers.toLocaleString("pt-BR")} compradores`
                : "Carregando..."}
            />
          </div>
        );
      })()}

      {/* ─── ROW 3: Consultor Estratégico ─── */}
      {!loading && overview?.source !== "not_configured" && (
        <StrategicAdvisorCard startDate={dateRange.startDate} endDate={dateRange.endDate} />
      )}

      {/* ─── ROW 4: Gráficos (7 abas) ─── */}
      {timeseries && timeseries.series.length > 1 && !loading && (
        <ChartsSection data={timeseries} ga4Data={ga4Data} />
      )}

      {/* ─── ROW 6: Segmentação (Dispositivo, Demografia, Geografia) ─── */}
      {intelligence?.segmentation && !loading && (
        <SegmentationSummary segmentation={intelligence.segmentation} />
      )}

      {/* ─── ROW 7: Budget Optimization ─── */}
      {intelligence?.budgetPlan && !loading && (
        <BudgetPlanCard plan={intelligence.budgetPlan} />
      )}
    </div>
  );
}
