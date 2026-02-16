"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange, OverviewResponse, SmartAlertsResponse, TimeSeriesResponse, GA4DataResponse } from "@/types/api";
import type { IntelligenceResponse } from "@/lib/intelligence/types";
import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
import { defaultRange, smartAlertStyles, categoryLabels } from "@/lib/constants";
import { formatBRL, fmtDate } from "@/lib/format";
import { generateInsights } from "@/lib/insights-engine";
import DateRangePicker from "@/components/ui/date-range-picker";
import ProgressBar from "@/components/ui/progress-bar";
import ChartsSection from "@/components/charts/charts-section";
import { KpiSkeleton, AlertsSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { ExecutiveSummary } from "@/components/intelligence/executive-summary";
import { InsightsGrid } from "@/components/intelligence/insights-grid";
import { RecommendationsPanel } from "@/components/intelligence/recommendations-panel";

/* ─── KPI Mini Card ─── */
function KpiCard({ label, value, sublabel, color }: { label: string; value: string; sublabel?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-zinc-900"}`}>{value}</p>
      {sublabel && <p className="text-[11px] text-zinc-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

export default function VisaoGeralPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResponse & Partial<CognitiveResponse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  const buildParams = useCallback((range: DateRange) => {
    const params = new URLSearchParams();
    params.set("period", range.preset ?? "custom");
    params.set("startDate", range.startDate);
    params.set("endDate", range.endDate);
    return params.toString();
  }, []);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const base = buildParams(range);
      const tsParams = new URLSearchParams(base);
      tsParams.set("scope", "account");

      const [overviewRes, alertsRes, tsRes, ga4Res, intelRes] = await Promise.all([
        fetch(`/api/overview?${base}`),
        fetch(`/api/alerts?${base}`).catch(() => null),
        fetch(`/api/timeseries?${tsParams.toString()}`).catch(() => null),
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
      setError("Não foi possível carregar os dados.");
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

  const insights = useMemo(
    () => generateInsights(overview, smartAlerts, ga4Data),
    [overview, smartAlerts, ga4Data]
  );

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
  const roasColor = overview ? (overview.meta.roasActual >= overview.meta.roasTarget ? "text-emerald-600" : overview.meta.roasActual >= overview.meta.roasTarget * 0.7 ? "text-amber-600" : "text-red-600") : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── TOP BAR: Período + Status ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Visão Geral</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDate(new Date(dateRange.startDate + "T12:00:00")).split("-").reverse().join("/")} — {fmtDate(new Date(dateRange.endDate + "T12:00:00")).split("-").reverse().join("/")}
            {overview && (
              <span className="ml-2 text-zinc-400">
                {overview.source === "google-ads" ? `Google Ads • ${overview.totalSkus} SKUs` : "Dados mock"}
              </span>
            )}
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
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

      {/* ─── KPIs (Google Ads) ─── */}
      {overview && acct && !loading && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Receita"
            value={formatBRL(acct.revenue)}
            sublabel={`${(Math.round(acct.conversions * 100) / 100).toLocaleString("pt-BR")} conversões`}
          />
          <KpiCard
            label="Investimento"
            value={formatBRL(acct.ads)}
            sublabel={`${acct.clicks.toLocaleString("pt-BR")} cliques`}
          />
          <KpiCard
            label="ROAS"
            value={overview.meta.roasActual.toFixed(1)}
            sublabel={`Meta: ${overview.meta.roasTarget.toFixed(1)}`}
            color={roasColor}
          />
          <KpiCard
            label="Impressões"
            value={acct.impressions.toLocaleString("pt-BR")}
            sublabel={`CTR: ${acct.impressions > 0 ? ((acct.clicks / acct.impressions) * 100).toFixed(2) : 0}%`}
          />
          <KpiCard
            label="Margem"
            value={`${overview.meta.marginActual}%`}
            sublabel={`Meta: ${overview.meta.marginTarget}%`}
            color={overview.meta.marginActual >= overview.meta.marginTarget ? "text-emerald-600" : "text-amber-600"}
          />
        </div>
      )}

      {/* ─── INTELIGÊNCIA: Executive Summary ─── */}
      {intelligence && !loading && (
        <ExecutiveSummary
          summary={intelligence.summary}
          mode={intelligence.mode}
          bottleneck={intelligence.bottleneck}
          pacingProjections={intelligence.pacingProjections}
          executiveSummary={intelligence.executiveSummary}
        />
      )}

      {/* ─── PROGRESSO vs PLANEJAMENTO + RECOMENDAÇÕES ─── */}
      {overview && !loading && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Progress Bars */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">Progresso vs Planejamento 2026</h2>
              <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-100">Mensal</span>
            </div>

            {overview.meta.revenueCaptadaTarget ? (
              <>
                <ProgressBar
                  label="Receita Captada"
                  actual={overview.meta.revenueActual}
                  target={overview.meta.revenueCaptadaTarget}
                  format={(v) => formatBRL(v)}
                />
                {overview.meta.approvalRate ? (
                  <ProgressBar
                    label="Receita Faturada"
                    sublabel={`est. ${(overview.meta.approvalRate * 100).toFixed(0)}% aprov.`}
                    actual={Math.round(overview.meta.revenueActual * overview.meta.approvalRate * 100) / 100}
                    target={overview.meta.revenueTarget}
                    format={(v) => formatBRL(v)}
                  />
                ) : (
                  <ProgressBar label="Receita Faturada" actual={overview.meta.revenueActual} target={overview.meta.revenueTarget} format={(v) => formatBRL(v)} />
                )}
              </>
            ) : (
              <ProgressBar label="Faturamento" actual={overview.meta.revenueActual} target={overview.meta.revenueTarget} format={(v) => formatBRL(v)} />
            )}

            {overview.meta.adsTarget ? (
              <ProgressBar label="Investimento Ads" actual={overview.meta.adsActual ?? 0} target={overview.meta.adsTarget} format={(v) => formatBRL(v)} />
            ) : null}
            <ProgressBar label="ROAS Captado" actual={overview.meta.roasActual} target={overview.meta.roasTarget} format={(v) => v.toFixed(1)} />
            <ProgressBar label="Margem Média" actual={overview.meta.marginActual} target={overview.meta.marginTarget} format={(v) => `${v}%`} />
          </div>

          {/* Recommendations */}
          {intelligence ? (
            <RecommendationsPanel
              insights={intelligence.insights}
              onFollow={handleFollowAction}
              onDismiss={handleDismissAction}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-800 mb-3">Recomendações</h2>
              <p className="text-sm text-zinc-400">Carregando análise inteligente...</p>
            </div>
          )}
        </div>
      )}

      {/* ─── INSIGHTS DETALHADOS ─── */}
      {intelligence && intelligence.insights.length > 0 && !loading && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-800">
            Insights Detalhados
            <span className="ml-2 text-zinc-400 font-normal">({intelligence.insights.length})</span>
          </h2>
          <InsightsGrid
            insights={intelligence.insights}
            onFollowAction={handleFollowAction}
          />
        </div>
      )}

      {/* ─── RESUMO EXECUTIVO LEGADO ─── */}
      {!intelligence && insights.length > 0 && !loading && (
        <div className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <h2 className="font-semibold text-sm text-indigo-900 mb-3">Resumo Executivo</h2>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-zinc-700 flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">
                  {insight.type === "positive" ? "✅" : insight.type === "negative" ? "⚠️" : "ℹ️"}
                </span>
                {insight.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ─── ALERTAS INTELIGENTES ─── */}
      {smartAlerts && smartAlerts.alerts.length > 0 && !loading && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-b border-zinc-100">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm font-semibold text-zinc-800">Alertas</h2>
              {smartAlerts.summary.danger > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                  {smartAlerts.summary.danger} crítico{smartAlerts.summary.danger > 1 ? "s" : ""}
                </span>
              )}
              {smartAlerts.summary.warn > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                  {smartAlerts.summary.warn} aviso{smartAlerts.summary.warn > 1 ? "s" : ""}
                </span>
              )}
              {smartAlerts.summary.success > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  {smartAlerts.summary.success} positivo{smartAlerts.summary.success > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-400">vs {smartAlerts.previousPeriod.start.split("-").reverse().join("/")} — {smartAlerts.previousPeriod.end.split("-").reverse().join("/")}</span>
              <button onClick={() => setAlertsCollapsed((c) => !c)} className="text-zinc-500 hover:text-zinc-700 font-medium">
                {alertsCollapsed ? "Expandir" : "Recolher"}
              </button>
            </div>
          </div>
          {!alertsCollapsed && (
            <div className="divide-y divide-zinc-50">
              {smartAlerts.alerts.map((alert) => {
                const sc = smartAlertStyles[alert.severity];
                return (
                  <div key={alert.id} className={`px-5 py-3 ${sc.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 flex-shrink-0">{sc.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${sc.text}`}>{alert.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                              {categoryLabels[alert.category]}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{alert.description}</p>
                          {alert.recommendation && (
                            <p className="text-xs mt-1 font-medium text-zinc-600">Recomendação: {alert.recommendation}</p>
                          )}
                        </div>
                      </div>
                      {alert.deltaPct !== 0 && (
                        <span className={`flex-shrink-0 text-xs font-mono px-2.5 py-1 rounded-lg ${alert.deltaPct < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {alert.deltaPct < 0 ? "↓" : "↑"} {Math.abs(alert.deltaPct)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── GRÁFICOS ─── */}
      {timeseries && timeseries.series.length > 1 && !loading && (
        <ChartsSection data={timeseries} ga4Data={ga4Data} />
      )}
    </div>
  );
}
