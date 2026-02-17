"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange, ApiResponse, OverviewResponse, CampaignsResponse, TimeSeriesResponse, GA4DataResponse } from "@/types/api";
import { useDateRange } from "@/hooks/use-date-range";
import { defaultRange, alertColors, channelColors, channelLabels } from "@/lib/constants";
import { formatBRL, formatPct, fmtConv, fmtDateSlash, roasStatus, cpaStatus, marginStatus } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import Kpi from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import ChannelBadge from "@/components/ui/channel-badge";
import CampaignStatusBadge from "@/components/ui/campaign-status-badge";
import SortableHeader from "@/components/ui/sortable-header";
import ChartsSection from "@/components/charts/charts-section";
import { TableSkeleton, KpiSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { exportToCSV } from "@/lib/export-csv";
import { Download, RefreshCw } from "lucide-react";

export default function AquisicaoPage() {
  const { dateRange, setDateRange, buildParams } = useDateRange();
  const [sku, setSku] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignsResponse | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuPage, setSkuPage] = useState(0);
  const [viewMode, setViewMode] = useState<"skus" | "campaigns">("skus");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterCampStatus, setFilterCampStatus] = useState("all");
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const SKUS_PER_PAGE = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sortArray<T extends Record<string, any>>(arr: T[], field: string, dir: "asc" | "desc"): T[] {
    if (!field) return arr;
    return [...arr].sort((a, b) => {
      const va = a[field] ?? 0;
      const vb = b[field] ?? 0;
      if (typeof va === "string") return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return dir === "asc" ? va - vb : vb - va;
    });
  }

  const filteredSkus = useMemo(() => {
    if (!overview) return [];
    let list = overview.skus;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.sku.toLowerCase().includes(q) || s.nome.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") list = list.filter((s) => s.status === filterStatus);
    return sortArray(list, sortField, sortDir);
  }, [overview, searchQuery, filterStatus, sortField, sortDir]);

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    let list = campaigns.campaigns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    if (filterChannel !== "all") list = list.filter((c) => c.channelType === filterChannel);
    if (filterCampStatus !== "all") list = list.filter((c) => c.status === filterCampStatus);
    return sortArray(list, sortField, sortDir);
  }, [campaigns, searchQuery, filterChannel, filterCampStatus, sortField, sortDir]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setSkuPage(0);
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterChannel("all");
    setFilterCampStatus("all");
    setSortField("");
    setSkuPage(0);
  }

  const loadData = useCallback(async (range: DateRange, s: string) => {
    setLoading(true);
    setError(null);
    try {
      const tsParams = buildParams(range, { scope: "account" });
      const [metricsRes, overviewRes, tsRes, campsRes, ga4Res] = await Promise.all([
        fetch(`/api/metrics?${buildParams(range, s ? { sku: s } : {})}`),
        fetch(`/api/overview?${buildParams(range)}`),
        fetch(`/api/timeseries?${tsParams}`).catch(() => null),
        fetch(`/api/campaigns?${buildParams(range)}`).catch(() => null),
        fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).catch(() => null),
      ]);
      if (!metricsRes.ok || !overviewRes.ok) throw new Error("Erro ao carregar dados");
      setData(await metricsRes.json());
      setOverview(await overviewRes.json());
      if (tsRes?.ok) setTimeseries(await tsRes.json());
      if (campsRes?.ok) setCampaigns(await campsRes.json());
      if (ga4Res?.ok) setGa4Data(await ga4Res.json());
    } catch {
      setError("Erro ao carregar dados. Tente novamente ou aguarde alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  function selectSku(s: string) {
    setSku(s);
    setViewMode("skus");
    loadData(dateRange, s);
  }

  function selectCampaign(campId: string) {
    setSelectedCampaign(campId);
    const tsParams = buildParams(dateRange, { scope: "campaign", campaignId: campId });
    fetch(`/api/timeseries?${tsParams}`)
      .then((r) => r.json())
      .then((tsJson: TimeSeriesResponse) => setTimeseries(tsJson))
      .catch(() => {});
  }

  function switchToAccountTimeSeries() {
    setSelectedCampaign(null);
    const tsParams = buildParams(dateRange, { scope: "account" });
    fetch(`/api/timeseries?${tsParams}`)
      .then((r) => r.json())
      .then((tsJson: TimeSeriesResponse) => setTimeseries(tsJson))
      .catch(() => {});
  }

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    setSelectedCampaign(null);
    resetFilters();
    loadData(range, sku);
  }

  useEffect(() => {
    const range = defaultRange();
    setLoading(true);
    fetch(`/api/overview?${buildParams(range)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar overview");
        return r.json();
      })
      .then((overviewJson: OverviewResponse) => {
        setOverview(overviewJson);
        const firstSku = overviewJson.skus[0]?.sku ?? "27290BR-CP";
        setSku(firstSku);
        const tsParams = buildParams(range, { scope: "account" });
        return Promise.all([
          fetch(`/api/metrics?${buildParams(range, { sku: firstSku })}`).then((r) => r.json()),
          fetch(`/api/timeseries?${tsParams}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/campaigns?${buildParams(range)}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json()).catch(() => null),
        ]);
      })
      .then(([metricsJson, tsJson, campsJson, ga4Json]: [ApiResponse, TimeSeriesResponse | null, CampaignsResponse | null, GA4DataResponse | null]) => {
        setData(metricsJson);
        if (tsJson) setTimeseries(tsJson);
        if (campsJson) setCampaigns(campsJson);
        if (ga4Json) setGa4Data(ga4Json);
      })
      .catch(() => setError("Não foi possível carregar os dados."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Google Ads</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {overview && (
              <span className="ml-2 text-zinc-400">
                {overview.source === "google-ads" ? `${overview.totalSkus} SKUs` : "Dados mock"}
              </span>
            )}
            {loading && <span className="ml-2 text-zinc-400">Carregando...</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* SKU search inline */}
          <div className="relative">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData(dateRange, sku)}
              placeholder="Buscar SKU..."
              aria-label="Buscar SKU"
              className="w-40 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <button
            onClick={() => loadData(dateRange, sku)}
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
          <button onClick={() => loadData(dateRange, sku)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ─── LOADING ─── */}
      {loading && !overview && (
        <>
          <TableSkeleton rows={8} />
          <div className="grid gap-4 md:grid-cols-4">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
          <ChartSkeleton />
        </>
      )}

      {/* ─── KPIs CONTA ─── */}
      {overview?.accountTotals && !loading && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Receita</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{formatBRL(overview.accountTotals.revenue)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Investimento</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{formatBRL(overview.accountTotals.ads)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">ROAS</p>
            <p className={`text-2xl font-bold mt-1 ${overview.meta.roasActual >= overview.meta.roasTarget ? "text-emerald-600" : overview.meta.roasActual >= overview.meta.roasTarget * 0.7 ? "text-amber-600" : "text-red-600"}`}>
              {overview.meta.roasActual.toFixed(1)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Conversões</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{fmtConv(overview.accountTotals.conversions)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Cliques</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{overview.accountTotals.clicks.toLocaleString("pt-BR")}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">CTR: {overview.accountTotals.impressions > 0 ? ((overview.accountTotals.clicks / overview.accountTotals.impressions) * 100).toFixed(2) : 0}%</p>
          </div>
        </div>
      )}

      {/* ─── TOGGLE SKUs / CAMPANHAS / META ─── */}
      {overview && (
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => { setViewMode("skus"); resetFilters(); if (selectedCampaign) switchToAccountTimeSeries(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "skus" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            SKUs
          </button>
          <button
            onClick={() => { setViewMode("campaigns"); resetFilters(); if (selectedCampaign) switchToAccountTimeSeries(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "campaigns" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            Campanhas
          </button>
        </div>
      )}

      {/* ─── RANKING DE SKUs ─── */}
      {overview && viewMode === "skus" && (() => {
        const totalPages = Math.ceil(filteredSkus.length / SKUS_PER_PAGE);
        const pageSkus = filteredSkus.slice(skuPage * SKUS_PER_PAGE, (skuPage + 1) * SKUS_PER_PAGE);
        const startIdx = skuPage * SKUS_PER_PAGE;
        return (
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-800">
                Ranking de SKUs
                <span className="ml-2 text-zinc-400 font-normal">
                  {filteredSkus.length !== overview.skus.length ? `${filteredSkus.length} de ${overview.skus.length}` : `${overview.skus.length} SKUs`}
                </span>
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => exportToCSV(filteredSkus, [
                    { key: "sku", label: "SKU" }, { key: "nome", label: "Nome" },
                    { key: "revenue", label: "Receita" }, { key: "ads", label: "Ads" },
                    { key: "roas", label: "ROAS" }, { key: "conversions", label: "Conv" },
                    { key: "cpa", label: "CPA" }, { key: "ctr", label: "CTR" },
                    { key: "status", label: "Ação" },
                  ], "skus-ranking.csv")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs text-zinc-600 hover:bg-white"
                  title="Exportar CSV"
                >
                  <Download size={12} /> CSV
                </button>
                {totalPages > 1 && (
                  <>
                    <button onClick={() => setSkuPage((p) => Math.max(0, p - 1))} disabled={skuPage === 0} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                    <span className="text-xs text-zinc-500">{skuPage + 1} / {totalPages}</span>
                    <button onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))} disabled={skuPage >= totalPages - 1} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
                  </>
                )}
              </div>
            </div>
            <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-50">
              <input type="text" placeholder="Buscar SKU ou nome..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSkuPage(0); }} aria-label="Filtrar SKUs por nome" className="w-full sm:w-56 px-3 py-1.5 text-sm border rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              <div className="flex gap-1">
                {[
                  { value: "all", label: "Todos", bg: "bg-zinc-200 text-zinc-700" },
                  { value: "escalar", label: "Escalar", bg: "bg-emerald-100 text-emerald-800" },
                  { value: "manter", label: "Manter", bg: "bg-amber-100 text-amber-800" },
                  { value: "pausar", label: "Pausar", bg: "bg-red-100 text-red-800" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => { setFilterStatus(opt.value); setSkuPage(0); }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === opt.value ? opt.bg : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] text-zinc-500">
                    <th className="py-2.5 px-5 text-left w-8">#</th>
                    <th className="py-2.5 pr-2 text-left">SKU</th>
                    <th className="py-2.5 pr-2 text-left">Nome</th>
                    <SortableHeader label="Receita" field="revenue" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Ads" field="ads" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="ROAS" field="roas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <SortableHeader label="Conv" field="conversions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-14" />
                    <SortableHeader label="CPA" field="cpa" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="CTR" field="ctr" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <th className="py-2.5 px-5 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSkus.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-zinc-400 text-sm">
                      {searchQuery || filterStatus !== "all" ? `Nenhum SKU encontrado${searchQuery ? ` para "${searchQuery}"` : ""}` : "Nenhum SKU disponível para o período."}
                    </td></tr>
                  )}
                  {pageSkus.map((s, i) => (
                    <tr key={s.sku} className={`border-b border-zinc-50 cursor-pointer transition-colors ${s.sku === sku ? "bg-blue-50/50" : "hover:bg-zinc-50/50"}`} onClick={() => selectSku(s.sku)}>
                      <td className="py-2 px-5 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{s.sku}</td>
                      <td className="py-2 pr-2 max-w-[200px] truncate text-zinc-700" title={s.nome}>{s.nome}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(s.revenue)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(s.ads)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.roas > 0 ? s.roas.toFixed(1) : "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{fmtConv(s.conversions)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.conversions > 0 ? formatBRL(s.cpa) : "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.ctr > 0 ? `${s.ctr.toFixed(2)}%` : "—"}</td>
                      <td className="py-2 px-5 text-center"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
                {overview.shoppingTotals && (
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 font-semibold text-zinc-700 bg-zinc-50">
                      <td className="py-2.5 px-5" colSpan={3}>Total Shopping</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(overview.shoppingTotals.revenue)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(overview.shoppingTotals.ads)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{overview.shoppingTotals.ads > 0 ? (overview.shoppingTotals.revenue / overview.shoppingTotals.ads).toFixed(1) : "—"}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{fmtConv(overview.skus.reduce((sum, s) => sum + s.conversions, 0))}</td>
                      <td className="py-2.5" colSpan={3} />
                    </tr>
                    {overview.accountTotals && (
                      <tr className="text-zinc-500 bg-zinc-50">
                        <td className="py-2 px-5 pb-3" colSpan={3}>Total Conta</td>
                        <td className="py-2 px-2 pb-3 text-right tabular-nums">{formatBRL(overview.accountTotals.revenue)}</td>
                        <td className="py-2 px-2 pb-3 text-right tabular-nums">{formatBRL(overview.accountTotals.ads)}</td>
                        <td className="py-2 px-2 pb-3 text-right tabular-nums">{overview.accountTotals.ads > 0 ? (overview.accountTotals.revenue / overview.accountTotals.ads).toFixed(1) : "—"}</td>
                        <td className="py-2 px-2 pb-3 text-right tabular-nums">{fmtConv(overview.accountTotals.conversions)}</td>
                        <td className="py-2 px-2 pb-3 text-right tabular-nums">{overview.accountTotals.impressions > 0 ? `${(overview.accountTotals.clicks / overview.accountTotals.impressions * 100).toFixed(2)}%` : "—"}</td>
                        <td className="py-2 pb-3" colSpan={2} />
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 py-3 border-t border-zinc-100">
                <button onClick={() => setSkuPage((p) => Math.max(0, p - 1))} disabled={skuPage === 0} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                <span className="text-xs text-zinc-500 flex items-center">Página {skuPage + 1} de {totalPages}</span>
                <button onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))} disabled={skuPage >= totalPages - 1} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TABELA DE CAMPANHAS ─── */}
      {campaigns && viewMode === "campaigns" && (() => {
        const totalPages = Math.ceil(filteredCampaigns.length / SKUS_PER_PAGE);
        const pageCamps = filteredCampaigns.slice(skuPage * SKUS_PER_PAGE, (skuPage + 1) * SKUS_PER_PAGE);
        const startIdx = skuPage * SKUS_PER_PAGE;
        const totals = filteredCampaigns.reduce((acc, c) => ({
          costBRL: acc.costBRL + c.costBRL, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks, conversions: acc.conversions + c.conversions, revenue: acc.revenue + c.revenue,
        }), { costBRL: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
        const channelTypes = [...new Set(campaigns.campaigns.map((c) => c.channelType))];
        return (
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-800">
                Campanhas
                <span className="ml-2 text-zinc-400 font-normal">
                  {filteredCampaigns.length !== campaigns.campaigns.length ? `${filteredCampaigns.length} de ${campaigns.campaigns.length}` : `${campaigns.campaigns.length} campanhas`}
                </span>
                {selectedCampaign && (
                  <button onClick={switchToAccountTimeSeries} className="ml-3 text-xs font-normal text-blue-600 hover:text-blue-800">Ver total da conta</button>
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => exportToCSV(filteredCampaigns, [
                    { key: "campaignName", label: "Campanha" }, { key: "channelType", label: "Tipo" },
                    { key: "status", label: "Status" }, { key: "costBRL", label: "Gasto" },
                    { key: "conversions", label: "Conv" }, { key: "revenue", label: "Receita" },
                    { key: "cpa", label: "CPA" }, { key: "roas", label: "ROAS" },
                    { key: "impressions", label: "Impressões" }, { key: "clicks", label: "Cliques" },
                  ], "campanhas.csv")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs text-zinc-600 hover:bg-white"
                  title="Exportar CSV"
                >
                  <Download size={12} /> CSV
                </button>
                {totalPages > 1 && (
                  <>
                    <button onClick={() => setSkuPage((p) => Math.max(0, p - 1))} disabled={skuPage === 0} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                    <span className="text-xs text-zinc-500">{skuPage + 1} / {totalPages}</span>
                    <button onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))} disabled={skuPage >= totalPages - 1} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
                  </>
                )}
              </div>
            </div>
            <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-50">
              <input type="text" placeholder="Buscar campanha..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSkuPage(0); }} aria-label="Filtrar campanhas" className="w-full sm:w-56 px-3 py-1.5 text-sm border rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => { setFilterChannel("all"); setSkuPage(0); }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterChannel === "all" ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}>Todos</button>
                {channelTypes.map((ct) => (
                  <button key={ct} onClick={() => { setFilterChannel(ct); setSkuPage(0); }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterChannel === ct ? (channelColors[ct] ?? "bg-zinc-200 text-zinc-700") : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}>
                    {channelLabels[ct] ?? ct}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[{ value: "all", label: "Todas" }, { value: "ENABLED", label: "Ativas" }, { value: "PAUSED", label: "Pausadas" }].map((opt) => (
                  <button key={opt.value} onClick={() => { setFilterCampStatus(opt.value); setSkuPage(0); }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterCampStatus === opt.value ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] text-zinc-500">
                    <th className="py-2.5 px-5 text-left w-8">#</th>
                    <th className="py-2.5 pr-2 text-left">Campanha</th>
                    <th className="py-2.5 px-2 text-center w-20">Tipo</th>
                    <th className="py-2.5 px-2 text-center w-16">Status</th>
                    <SortableHeader label="Gasto" field="costBRL" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Conv" field="conversions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-14" />
                    <SortableHeader label="Receita" field="revenue" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="CPA" field="cpa" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="ROAS" field="roas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <SortableHeader label="Impr." field="impressions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Cliques" field="clicks" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {pageCamps.length === 0 && (
                    <tr><td colSpan={11} className="py-8 text-center text-zinc-400 text-sm">
                      {searchQuery || filterChannel !== "all" || filterCampStatus !== "all" ? `Nenhuma campanha encontrada${searchQuery ? ` para "${searchQuery}"` : ""}` : "Nenhuma campanha disponível para o período."}
                    </td></tr>
                  )}
                  {pageCamps.map((c, i) => (
                    <tr key={c.campaignId} className={`border-b border-zinc-50 cursor-pointer transition-colors ${c.campaignId === selectedCampaign ? "bg-blue-50/50" : "hover:bg-zinc-50/50"}`} onClick={() => selectCampaign(c.campaignId)}>
                      <td className="py-2 px-5 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                      <td className="py-2 pr-2 max-w-[220px] truncate text-zinc-700" title={c.campaignName}>{c.campaignName}</td>
                      <td className="py-2 px-2 text-center"><ChannelBadge type={c.channelType} /></td>
                      <td className="py-2 px-2 text-center"><CampaignStatusBadge status={c.status} /></td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(c.costBRL)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{fmtConv(c.conversions)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(c.revenue)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.conversions > 0 ? formatBRL(c.cpa) : "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.roas > 0 ? c.roas.toFixed(1) : "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.impressions.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-5 text-right tabular-nums">{c.clicks.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 font-semibold text-zinc-700 bg-zinc-50">
                    <td className="py-2.5 px-5" colSpan={4}>Total</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(totals.costBRL)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{fmtConv(totals.conversions)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(totals.revenue)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{totals.conversions > 0 ? formatBRL(totals.costBRL / totals.conversions) : "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{totals.costBRL > 0 ? (totals.revenue / totals.costBRL).toFixed(1) : "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{totals.impressions.toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 px-5 text-right tabular-nums">{totals.clicks.toLocaleString("pt-BR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── GRÁFICOS ─── */}
      {timeseries && timeseries.series.length > 1 && !loading && (
        <ChartsSection data={timeseries} ga4Data={ga4Data} />
      )}

      {/* ─── KPIs — SKU SELECIONADO ─── */}
      {data && viewMode === "skus" && !loading && (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-zinc-800">
                KPIs — {data.skuTitle || data.sku}
              </h2>
              {data.source === "google-ads" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Google Ads</span>}
              {data.source === "mock" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Mock</span>}
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Kpi title="ROAS" value={data.cards.roas.toFixed(2)} subtitle="Meta: 7,0 • Pausa: < 5,0" status={roasStatus(data.cards.roas)} />
              <Kpi title="CPA" value={data.cards.cpa > 0 ? formatBRL(data.cards.cpa) : "—"} subtitle="Limite: R$80 • Meta: < R$60" status={cpaStatus(data.cards.cpa)} />
              <Kpi title="Margem" value={`${data.cards.marginPct}%`} subtitle="Meta: >= 25%" status={marginStatus(data.cards.marginPct)} />
              <Kpi title="Após Ads" value={formatBRL(data.cards.profitAfterAds)} subtitle="Lucro real" status={data.cards.profitAfterAds < 0 ? "danger" : "ok"} />
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-3">
              <Kpi title="Receita" value={formatBRL(data.cards.revenue)} subtitle="Faturamento bruto" />
              <Kpi title="Gasto Ads" value={formatBRL(data.cards.ads)} subtitle="Investimento Shopping" />
              <Kpi title="Ticket Médio" value={formatBRL(data.cards.arpur)} subtitle="Receita / conversões" />
              <Kpi title="Taxa Conversão" value={formatPct(data.cards.convRate)} subtitle="Conversões / cliques" />
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-3">
              <Kpi title="CPC" value={formatBRL(data.cards.cpc)} subtitle="Custo por clique" />
              <Kpi title="CPM" value={formatBRL(data.cards.cpm)} subtitle="Custo por mil impr." />
              <Kpi title="Conversões" value={fmtConv(data.cards.conversions)} subtitle={`${data.cards.clicks.toLocaleString("pt-BR")} cliques`} />
              <Kpi title="Lucro Bruto" value={formatBRL(data.cards.grossProfit)} subtitle="Receita x margem" />
            </div>
          </div>

          {/* ALERTAS SKU */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div key={alert.title} className={`rounded-xl border p-4 ${alertColors[alert.severity]}`}>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-sm opacity-80">{alert.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* FUNIL SKU */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-800">Funil — {data.skuTitle || data.sku}</h2>
              {data.source === "google-ads" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Google Ads</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] text-zinc-500">
                  <th className="py-2.5 px-5 text-left font-medium">Etapa</th>
                  <th className="py-2.5 px-3 font-medium text-right">Qtd</th>
                  <th className="py-2.5 px-3 font-medium text-right">Taxa</th>
                  <th className="py-2.5 px-5 font-medium text-right">Ads</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((row) => (
                  <tr key={row.etapa} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 px-5 font-medium text-zinc-700">{row.etapa}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{row.qtd.toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatPct(row.taxa)}</td>
                    <td className="py-2 px-5 text-right tabular-nums">{row.custo ? formatBRL(row.custo) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
