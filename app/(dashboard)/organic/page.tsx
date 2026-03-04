"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "@/types/api";
import type { OrganicDataResponse, OrganicStrategyResponse, KeywordClassification } from "@/lib/organic-types";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtDateSlash } from "@/lib/format";
import { exportToCSV } from "@/lib/export-csv";
import { useLastUpdated } from "@/hooks/use-last-updated";
import DateRangePicker from "@/components/ui/date-range-picker";
import OrganicTrendChart from "@/components/charts/organic-trend-chart";
import KeywordPositionChart from "@/components/charts/keyword-position-chart";
import CannibalizationChart from "@/components/charts/cannibalization-chart";
import { EmptyIntegrationState } from "@/components/ui/empty-integration-state";
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  DollarSign,
  Shield,
  Zap,
  RotateCcw,
  FlaskConical,
  Ban,
} from "lucide-react";

/* =========================
   Classification helpers
========================= */

const classificationConfig: Record<KeywordClassification, {
  label: string;
  bg: string;
  text: string;
  icon: React.ElementType;
}> = {
  proteger: { label: "Proteger", bg: "bg-emerald-100", text: "text-emerald-800", icon: Shield },
  escalar: { label: "Escalar", bg: "bg-blue-100", text: "text-blue-800", icon: Zap },
  recuperar: { label: "Recuperar", bg: "bg-amber-100", text: "text-amber-800", icon: RotateCcw },
  testar: { label: "Testar", bg: "bg-purple-100", text: "text-purple-800", icon: FlaskConical },
  ignorar: { label: "Ignorar", bg: "bg-zinc-100", text: "text-zinc-500", icon: Ban },
};

const effortConfig: Record<string, { label: string; color: string }> = {
  baixo: { label: "Baixo", color: "text-emerald-700 bg-emerald-50" },
  medio: { label: "Medio", color: "text-amber-700 bg-amber-50" },
  alto: { label: "Alto", color: "text-red-700 bg-red-50" },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  imediata: { label: "Imediata", color: "text-red-700 bg-red-50" },
  esta_semana: { label: "Esta semana", color: "text-amber-700 bg-amber-50" },
  este_mes: { label: "Este mes", color: "text-blue-700 bg-blue-50" },
};

const issueLabels: Record<string, string> = {
  high_traffic_low_conv: "Alto trafego, baixa conversao",
  high_bounce: "Bounce rate elevado",
  unexploited: "CTR abaixo do esperado",
  ranking_drop: "Queda de ranking",
};

/* =========================
   Main Page
========================= */

export default function OrganicPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<OrganicDataResponse | null>(null);
  const [strategy, setStrategy] = useState<OrganicStrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kwFilter, setKwFilter] = useState<string>("todos");
  const [showAllKw, setShowAllKw] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const { label: updatedLabel, markUpdated } = useLastUpdated();

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, stratRes] = await Promise.all([
        fetch(`/api/organic?startDate=${range.startDate}&endDate=${range.endDate}`),
        fetch(`/api/organic-strategy?startDate=${range.startDate}&endDate=${range.endDate}`),
      ]);
      if (!orgRes.ok) throw new Error("Erro ao carregar dados organicos");
      const orgData = await orgRes.json();
      setData(orgData);
      if (stratRes.ok) {
        setStrategy(await stratRes.json());
      }
      markUpdated();
    } catch {
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [markUpdated]);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  const summary = data?.summary;
  const keywords = data?.keywords ?? [];
  const pages = data?.pages ?? [];
  const dailySeries = data?.dailySeries ?? [];
  const cannibalization = data?.cannibalization ?? [];
  const cannibSummary = data?.cannibalizationSummary;
  const decisions = strategy?.decisions ?? [];
  const strategySummary = strategy?.summary;

  // Filtered keywords
  const filteredKw = kwFilter === "todos"
    ? keywords
    : keywords.filter((k) => k.classification === kwFilter);
  const visibleKw = showAllKw ? filteredKw : filteredKw.slice(0, 30);
  const visiblePages = showAllPages ? pages : pages.slice(0, 15);

  // Tab counts
  const classificationCounts: Record<string, number> = { todos: keywords.length };
  for (const kw of keywords) {
    classificationCounts[kw.classification] = (classificationCounts[kw.classification] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* --- TOP BAR --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-zinc-900">Inteligência Orgânica</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {data?.source === "gsc" && <span className="ml-2 text-zinc-400">GSC + GA4</span>}
            {loading && <span className="ml-2 text-zinc-400">Atualizando...</span>}
            {updatedLabel && !loading && (
              <span className="ml-2 text-zinc-400">· {updatedLabel}</span>
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

      {/* --- ERRO --- */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0">Tentar novamente</button>
        </div>
      )}

      {/* --- LOADING SKELETON --- */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
          <ChartSkeleton />
          <TableSkeleton rows={8} />
        </div>
      )}

      {/* --- NOT CONFIGURED --- */}
      {data?.source === "not_configured" && (
        <EmptyIntegrationState
          platform="Google Search Console"
          message="Para visualizar dados de inteligência orgânica (keywords, posições, cliques), configure a integração com o Google Search Console."
        />
      )}

      {/* --- SAVINGS BADGE --- */}
      {cannibSummary && cannibSummary.totalSavingsBRL > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Economia potencial: {formatBRL(cannibSummary.totalSavingsBRL)}/periodo
            </p>
            <p className="text-xs text-amber-600">
              {cannibSummary.totalEntries} keywords com overlap organico/pago detectados ({cannibSummary.fullCannibals} canibalizacao total)
            </p>
          </div>
        </div>
      )}

      {/* --- KPIs --- */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Cliques Org.</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.totalClicks.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Impressoes</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.totalImpressions.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Posicao Media</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.avgPosition.toFixed(1)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">CTR</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.avgCtr.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Receita Org.</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{formatBRL(summary.organicRevenue)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">% da Receita</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.organicRevenueShare.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* --- DECISOES ESTRATEGICAS --- */}
      {decisions.length > 0 && strategySummary && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-zinc-800">Decisoes Estrategicas</h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-zinc-500">Impacto total: <strong className="text-emerald-700">{formatBRL(strategySummary.totalImpactBRL)}</strong></span>
              {strategySummary.totalSavingsBRL > 0 && (
                <span className="text-zinc-500">Economia: <strong className="text-amber-700">{formatBRL(strategySummary.totalSavingsBRL)}</strong></span>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {decisions.map((dec) => (
              <div key={dec.id} className="rounded-lg border border-zinc-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800">{dec.action}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{dec.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-700">{formatBRL(dec.estimatedImpactBRL)}</p>
                    <p className="text-[10px] text-zinc-400">impacto/periodo</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${effortConfig[dec.effort]?.color}`}>
                    Esforco: {effortConfig[dec.effort]?.label}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgencyConfig[dec.urgency]?.color}`}>
                    {urgencyConfig[dec.urgency]?.label}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="text-zinc-500"><strong>Google Ads:</strong> {dec.connectionToPaid}</div>
                  <div className="text-zinc-500"><strong>CRO:</strong> {dec.connectionToCRO}</div>
                  <div className="text-red-500"><strong>Nao fazer:</strong> {dec.antiRecommendation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TENDENCIA DIARIA --- */}
      {dailySeries.length > 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Tendencia Diaria Organica</h2>
          <OrganicTrendChart data={dailySeries} />
        </div>
      )}

      {/* --- KEYWORDS TABLE --- */}
      {keywords.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">Keywords ({filteredKw.length})</h3>
              <button
                onClick={() => {
                  exportToCSV(
                    filteredKw.map((k) => ({
                      query: k.query,
                      clicks: k.clicks,
                      impressions: k.impressions,
                      ctr: (k.ctr * 100).toFixed(2),
                      position: k.position.toFixed(1),
                      score: k.score,
                      classification: k.classification,
                      impactBRL: k.estimatedImpactBRL.toFixed(2),
                    })),
                    [
                      { key: "query", label: "Keyword" },
                      { key: "clicks", label: "Cliques" },
                      { key: "impressions", label: "Impressões" },
                      { key: "ctr", label: "CTR" },
                      { key: "position", label: "Posição" },
                      { key: "score", label: "Score" },
                      { key: "classification", label: "Classificação" },
                      { key: "impactBRL", label: "Impacto R$" },
                    ],
                    "keywords-organicas.csv",
                  );
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700"
                title="Exportar CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
              {["todos", "escalar", "proteger", "recuperar", "testar", "ignorar"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setKwFilter(tab); setShowAllKw(false); }}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                    kwFilter === tab
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} ({classificationCounts[tab] ?? 0})
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Keyword</th>
                  <th className="px-3 py-3 font-medium text-center">Score</th>
                  <th className="px-3 py-3 font-medium text-center">Class.</th>
                  <th className="px-3 py-3 font-medium text-right">Cliques</th>
                  <th className="px-3 py-3 font-medium text-right">Impressoes</th>
                  <th className="px-3 py-3 font-medium text-right">CTR</th>
                  <th className="px-3 py-3 font-medium text-right">Posicao</th>
                  <th className="px-3 py-3 font-medium text-right">Delta Pos.</th>
                  <th className="px-5 py-3 font-medium text-right">Impacto R$</th>
                </tr>
              </thead>
              <tbody>
                {visibleKw.map((kw) => {
                  const cls = classificationConfig[kw.classification];
                  const dp = kw.deltaPosition ?? 0;
                  return (
                    <tr key={kw.query} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-2.5">
                        <p className="text-xs font-medium text-zinc-700 max-w-[200px] truncate">{kw.query}</p>
                        {kw.landingPage && (
                          <p className="text-[10px] text-zinc-400 truncate max-w-[200px]">{kw.landingPage}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          kw.score >= 70 ? "text-emerald-700 bg-emerald-50" :
                          kw.score >= 40 ? "text-amber-700 bg-amber-50" :
                          "text-zinc-500 bg-zinc-50"
                        }`}>
                          {kw.score}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls.bg} ${cls.text}`}>
                          {cls.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{kw.clicks.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{kw.impressions.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{(kw.ctr * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{kw.position.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {dp !== 0 && (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dp > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {dp > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {dp > 0 ? "+" : ""}{dp.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs font-semibold text-emerald-700">
                        {kw.estimatedImpactBRL > 0 ? formatBRL(kw.estimatedImpactBRL) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredKw.length > 30 && (
            <div className="px-5 py-3 border-t border-zinc-100 text-center">
              <button
                onClick={() => setShowAllKw(!showAllKw)}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
              >
                {showAllKw ? (
                  <>Mostrar menos <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver todas as {filteredKw.length} keywords <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- SCATTER CHART --- */}
      {keywords.length > 5 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Posicao vs Receita Estimada</h2>
          <KeywordPositionChart data={keywords} filter={kwFilter} />
        </div>
      )}

      {/* --- PAGES TABLE --- */}
      {pages.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">Paginas ({pages.length})</h3>
              <button
                onClick={() => {
                  exportToCSV(
                    pages.map((p) => ({
                      path: p.path,
                      clicks: p.clicks,
                      impressions: p.impressions,
                      position: p.position.toFixed(1),
                      score: p.score,
                      revenue: p.revenue.toFixed(2),
                      convRate: p.convRate.toFixed(2),
                      issues: p.issues.join("; "),
                    })),
                    [
                      { key: "path", label: "Página" },
                      { key: "clicks", label: "Cliques" },
                      { key: "impressions", label: "Impressões" },
                      { key: "position", label: "Posição" },
                      { key: "score", label: "Score" },
                      { key: "revenue", label: "Receita" },
                      { key: "convRate", label: "Conv%" },
                      { key: "issues", label: "Issues" },
                    ],
                    "paginas-organicas.csv",
                  );
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700"
                title="Exportar CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Pagina</th>
                  <th className="px-3 py-3 font-medium text-center">Score</th>
                  <th className="px-3 py-3 font-medium text-right">Cliques</th>
                  <th className="px-3 py-3 font-medium text-right">Posicao</th>
                  <th className="px-3 py-3 font-medium text-right">Sessoes</th>
                  <th className="px-3 py-3 font-medium text-right">Receita</th>
                  <th className="px-3 py-3 font-medium text-right">Conv %</th>
                  <th className="px-3 py-3 font-medium text-right">Add Cart %</th>
                  <th className="px-5 py-3 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {visiblePages.map((page) => (
                  <tr
                    key={page.path}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <p className="text-xs font-medium text-zinc-700 max-w-[220px] truncate">{page.path}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        page.score >= 70 ? "text-emerald-700 bg-emerald-50" :
                        page.score >= 40 ? "text-amber-700 bg-amber-50" :
                        "text-zinc-500 bg-zinc-50"
                      }`}>
                        {page.score}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.clicks.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.position.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.sessions.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-zinc-800">{formatBRL(page.revenue)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.convRate.toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.addToCartRate.toFixed(1)}%</td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {page.issues.map((issue) => (
                          <span key={issue} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                            {issueLabels[issue] ?? issue}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages.length > 15 && (
            <div className="px-5 py-3 border-t border-zinc-100 text-center">
              <button
                onClick={() => setShowAllPages(!showAllPages)}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
              >
                {showAllPages ? (
                  <>Mostrar menos <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver todas as {pages.length} paginas <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- CANNIBALIZATION TABLE --- */}
      {cannibalization.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-zinc-800">Canibalizacao Organico vs Pago</h2>
            </div>
            <CannibalizationChart data={cannibalization} />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-800">Detalhe Canibalizacao ({cannibalization.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                    <th className="px-5 py-3 font-medium">Keyword</th>
                    <th className="px-3 py-3 font-medium text-right">Pos. Org.</th>
                    <th className="px-3 py-3 font-medium text-right">Cliques Org.</th>
                    <th className="px-3 py-3 font-medium text-right">Custo Pago</th>
                    <th className="px-3 py-3 font-medium text-right">Conv. Pagas</th>
                    <th className="px-3 py-3 font-medium text-center">Tipo</th>
                    <th className="px-3 py-3 font-medium text-center">Match</th>
                    <th className="px-5 py-3 font-medium text-right">Economia Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {cannibalization.slice(0, 20).map((c) => {
                    const typeConfig: Record<string, { label: string; color: string }> = {
                      full_cannibal: { label: "Total", color: "text-red-700 bg-red-50" },
                      partial_overlap: { label: "Parcial", color: "text-amber-700 bg-amber-50" },
                      dual_dominance: { label: "Duplo", color: "text-blue-700 bg-blue-50" },
                    };
                    const tc = typeConfig[c.type] ?? typeConfig.partial_overlap;
                    return (
                      <tr key={c.keyword} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="text-xs font-medium text-zinc-700 max-w-[200px] truncate">{c.keyword}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{c.organicPosition.toFixed(1)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{c.organicClicks.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{formatBRL(c.paidCostBRL)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{c.paidConversions.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] ${c.matchType === "exact" ? "text-emerald-600" : "text-zinc-400"}`}>
                            {c.matchType === "exact" ? "Exato" : "Fuzzy"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs font-semibold text-amber-700">
                          {c.estimatedSavingsBRL > 0 ? formatBRL(c.estimatedSavingsBRL) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
