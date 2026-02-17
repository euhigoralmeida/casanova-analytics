"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, OverviewResponse, SmartAlertsResponse, TimeSeriesResponse, GA4DataResponse } from "@/types/api";
import { useDateRange } from "@/hooks/use-date-range";
import type { IntelligenceResponse } from "@/lib/intelligence/types";
import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
import { defaultRange, smartAlertStyles } from "@/lib/constants";
import { formatBRL, fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import ChartsSection from "@/components/charts/charts-section";
import Kpi from "@/components/ui/kpi-card";
import { KpiSkeleton, AlertsSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { ExecutiveSummary } from "@/components/intelligence/executive-summary";
import { RecommendationsPanel } from "@/components/intelligence/recommendations-panel";
import { BudgetPlanCard } from "@/components/intelligence/budget-plan-card";
import { SegmentationSummary } from "@/components/intelligence/segmentation-summary";
import { RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function VisaoGeralPage() {
  const { dateRange, setDateRange, buildParams } = useDateRange();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResponse & Partial<CognitiveResponse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const base = buildParams(range);

      const [overviewRes, alertsRes, tsRes, ga4Res, intelRes] = await Promise.all([
        fetch(`/api/overview?${base}`),
        fetch(`/api/alerts?${base}`).catch(() => null),
        fetch(`/api/timeseries?${buildParams(range, { scope: "account" })}`).catch(() => null),
        fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).catch(() => null),
        fetch(`/api/intelligence?${base}`).catch(() => null),
      ]);

      if (!overviewRes.ok) throw new Error("Erro ao carregar dados");
      setOverview(await overviewRes.json());
      if (alertsRes?.ok) setSmartAlerts(await alertsRes.json());
      if (tsRes?.ok) setTimeseries(await tsRes.json());
      if (ga4Res?.ok) setGa4Data(await ga4Res.json());
      if (intelRes?.ok) setIntelligence(await intelRes.json());
    } catch {
      setError("Erro ao carregar dados. Tente novamente ou aguarde alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  const handleFollowAction = useCallback(async (insightId: string, action: string) => {
    try {
      await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, actionType: "followed", description: action }),
      });
    } catch { /* silent */ }
  }, []);

  const handleDismissAction = useCallback(async (insightId: string, action: string) => {
    try {
      await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, actionType: "dismissed", description: action }),
      });
    } catch { /* silent */ }
  }, []);

  const acct = overview?.accountTotals;
  const roasColor = overview
    ? (overview.meta.roasActual >= overview.meta.roasTarget ? "text-emerald-600" : overview.meta.roasActual >= overview.meta.roasTarget * 0.7 ? "text-amber-600" : "text-red-600")
    : undefined;

  // Top 5 alerts sorted by severity
  const severityOrder: Record<string, number> = { danger: 0, warn: 1, info: 2, success: 3 };
  const topAlerts = smartAlerts
    ? [...smartAlerts.alerts].sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)).slice(0, 5)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── ROW 1: Header — título + date picker + refresh ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Visão Geral</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {overview && (
              <span className="ml-2 text-zinc-400">
                {overview.source === "google-ads" ? `Google Ads • ${overview.totalSkus} SKUs` : "Dados mock"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* ─── LOADING ─── */}
      {loading && !overview && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
          <AlertsSkeleton />
          <ChartSkeleton />
        </>
      )}

      {/* ─── ROW 2: 5 KPI Cards com progress bar embutido ─── */}
      {overview && acct && !loading && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Kpi
            title="Receita"
            value={formatBRL(acct.revenue)}
            subtitle={`${(Math.round(acct.conversions * 100) / 100).toLocaleString("pt-BR")} conversões`}
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
            color={roasColor}
            progress={{ actual: overview.meta.roasActual, target: overview.meta.roasTarget, format: (v) => v.toFixed(1) }}
          />
          <Kpi
            title="Conversões"
            value={(Math.round(acct.conversions * 100) / 100).toLocaleString("pt-BR")}
            subtitle={`CTR: ${acct.impressions > 0 ? ((acct.clicks / acct.impressions) * 100).toFixed(2) : 0}%`}
          />
          <Kpi
            title="Margem"
            value={`${overview.meta.marginActual}%`}
            subtitle={`Meta: ${overview.meta.marginTarget}%`}
            color={overview.meta.marginActual >= overview.meta.marginTarget ? "text-emerald-600" : "text-amber-600"}
            progress={{ actual: overview.meta.marginActual, target: overview.meta.marginTarget, format: (v) => `${v}%` }}
          />
        </div>
      )}

      {/* ─── ROW 3: Executive Summary consolidado ─── */}
      {intelligence && !loading && (
        <ExecutiveSummary
          summary={intelligence.summary}
          mode={intelligence.mode}
          bottleneck={intelligence.bottleneck}
          pacingProjections={intelligence.pacingProjections}
          executiveSummary={intelligence.executiveSummary}
          accountTrend={intelligence.accountTrend}
        />
      )}

      {/* Legacy fallback when no intelligence */}
      {!intelligence && overview && !loading && (
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <h2 className="font-semibold text-sm text-indigo-900 mb-2">Resumo</h2>
          <p className="text-sm text-zinc-600">
            {overview.meta.roasActual >= overview.meta.roasTarget
              ? `ROAS ${overview.meta.roasActual.toFixed(1)} acima da meta (${overview.meta.roasTarget.toFixed(1)}). Operação saudável.`
              : `ROAS ${overview.meta.roasActual.toFixed(1)} abaixo da meta (${overview.meta.roasTarget.toFixed(1)}). Atenção necessária.`}
          </p>
        </div>
      )}

      {/* ─── ROW 4: Recomendações (7fr) + Alertas top 5 (5fr) ─── */}
      {overview && !loading && (
        <div className="grid gap-6 lg:grid-cols-[7fr_5fr]">
          {/* Recommendations */}
          {intelligence ? (
            <RecommendationsPanel
              insights={intelligence.insights}
              quickWins={intelligence.summary.quickWins}
              onFollow={handleFollowAction}
              onDismiss={handleDismissAction}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-800 mb-3">Recomendações</h2>
              <p className="text-sm text-zinc-400">
                {loading ? "Carregando análise inteligente..." : "Análise indisponível neste período."}
              </p>
            </div>
          )}

          {/* Compact Alerts — top 5 */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Alertas</h3>
              {smartAlerts && smartAlerts.summary.danger > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                  {smartAlerts.summary.danger} crítico{smartAlerts.summary.danger > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {topAlerts.length > 0 ? (
              <div className="divide-y divide-zinc-50">
                {topAlerts.map((alert) => {
                  const sc = smartAlertStyles[alert.severity];
                  return (
                    <div key={alert.id} className="flex items-center gap-2.5 px-5 py-2.5">
                      <span className="flex-shrink-0 text-sm">{sc.icon}</span>
                      <span className={`text-sm font-medium truncate flex-1 ${sc.text}`}>
                        {alert.title}
                      </span>
                      {alert.deltaPct !== 0 && (
                        <span className={`flex-shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-md ${alert.deltaPct < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {alert.deltaPct < 0 ? "↓" : "↑"} {Math.abs(alert.deltaPct)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-400">Nenhum alerta no período</p>
              </div>
            )}
            {smartAlerts && smartAlerts.alerts.length > 5 && (
              <div className="px-5 py-2.5 border-t border-zinc-100">
                <Link href="/alerts" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5">
                  Ver todos os {smartAlerts.alerts.length} alertas <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ROW 5: Gráficos (7 abas) ─── */}
      {timeseries && timeseries.series.length > 1 && !loading && (
        <ChartsSection data={timeseries} ga4Data={ga4Data} />
      )}

      {/* ─── ROW 6: Segmentação + Budget lado a lado ─── */}
      {(intelligence?.segmentation || intelligence?.budgetPlan) && !loading && (() => {
        const hasBothBottomPanels = !!intelligence?.segmentation && !!intelligence?.budgetPlan;
        return (
          <div className={`grid gap-6 ${hasBothBottomPanels ? "lg:grid-cols-2" : ""}`}>
            {intelligence.segmentation && (
              <SegmentationSummary segmentation={intelligence.segmentation} compact={hasBothBottomPanels} />
            )}
            {intelligence.budgetPlan && (
              <BudgetPlanCard plan={intelligence.budgetPlan} />
            )}
          </div>
        );
      })()}
    </div>
  );
}
