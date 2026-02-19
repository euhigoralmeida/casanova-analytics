"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MetaAdsResponse } from "@/types/api";
import { useDateRange } from "@/hooks/use-date-range";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtConv, fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import Kpi from "@/components/ui/kpi-card";
import SortableHeader from "@/components/ui/sortable-header";
import { TableSkeleton, KpiSkeleton } from "@/components/ui/skeleton";
import { exportToCSV } from "@/lib/export-csv";
import { Download, RefreshCw, AlertTriangle } from "lucide-react";
import type { DateRange } from "@/types/api";

export default function MetaAdsPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [data, setData] = useState<MetaAdsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

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

  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    let list = data.campaigns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") list = list.filter((c) => c.status === filterStatus);
    return sortArray(list, sortField, sortDir);
  }, [data, searchQuery, filterStatus, sortField, sortDir]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterStatus("all");
    setSortField("");
    setPage(0);
  }

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta?startDate=${range.startDate}&endDate=${range.endDate}`);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      setData(await res.json());
    } catch {
      setError("Erro ao carregar dados do Meta Ads. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    resetFilters();
    loadData(range);
  }

  useEffect(() => {
    const range = defaultRange();
    loadData(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notConfigured = data?.source === "not_configured";
  const totals = data?.accountTotals;

  const totalPages = Math.ceil(filteredCampaigns.length / PER_PAGE);
  const pageCampaigns = filteredCampaigns.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const startIdx = page * PER_PAGE;
  const tableTotals = filteredCampaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions,
      revenue: acc.revenue + c.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Meta Ads</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {data && !notConfigured && (
              <span className="ml-2 text-zinc-400">
                {data.campaigns.length} campanhas
              </span>
            )}
            {loading && <span className="ml-2 text-zinc-400">Carregando...</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* ─── NOT CONFIGURED ─── */}
      {notConfigured && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Meta Ads não configurado</h3>
              <p className="text-sm text-amber-700 mt-1">
                Para conectar o Meta Ads, configure as variáveis de ambiente:
              </p>
              <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li><code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">META_ADS_ACCESS_TOKEN</code> — Token de acesso (System User ou Long-lived)</li>
                <li><code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">META_ADS_ACCOUNT_ID</code> — ID numérico da conta de anúncios</li>
              </ul>
              <p className="text-xs text-amber-600 mt-3">
                Gere o token em business.facebook.com → Configurações → Contas → Apps. Escopos necessários: ads_read.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOADING ─── */}
      {loading && !data && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
          <TableSkeleton rows={8} />
        </>
      )}

      {/* ─── KPIs CONTA ─── */}
      {totals && !notConfigured && !loading && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Kpi title="Investimento" value={formatBRL(totals.spend)} subtitle="Gasto total no período" />
          <Kpi title="Impressões" value={totals.impressions.toLocaleString("pt-BR")} subtitle={`CPM: ${formatBRL(totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0)}`} />
          <Kpi title="Cliques" value={totals.clicks.toLocaleString("pt-BR")} subtitle={`CPC: ${formatBRL(totals.cpc)} | CTR: ${totals.ctr}%`} />
          <Kpi title="Conversões" value={fmtConv(totals.conversions)} subtitle={`CPA: ${totals.conversions > 0 ? formatBRL(totals.cpa) : "—"}`} />
          <Kpi
            title="ROAS"
            value={totals.roas > 0 ? totals.roas.toFixed(2) : "—"}
            subtitle={`Receita: ${formatBRL(totals.revenue)}`}
            status={totals.roas >= 3 ? "ok" : totals.roas >= 1.5 ? "warn" : totals.roas > 0 ? "danger" : undefined}
          />
        </div>
      )}

      {/* ─── TABELA DE CAMPANHAS ─── */}
      {data && !notConfigured && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              Campanhas
              <span className="ml-2 text-zinc-400 font-normal">
                {filteredCampaigns.length !== data.campaigns.length
                  ? `${filteredCampaigns.length} de ${data.campaigns.length}`
                  : `${data.campaigns.length} campanhas`}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => exportToCSV(filteredCampaigns, [
                  { key: "campaignName", label: "Campanha" },
                  { key: "objective", label: "Objetivo" },
                  { key: "status", label: "Status" },
                  { key: "spend", label: "Investimento" },
                  { key: "conversions", label: "Conversões" },
                  { key: "revenue", label: "Receita" },
                  { key: "cpa", label: "CPA" },
                  { key: "roas", label: "ROAS" },
                  { key: "impressions", label: "Impressões" },
                  { key: "clicks", label: "Cliques" },
                ], "meta-ads-campanhas.csv")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs text-zinc-600 hover:bg-white"
                title="Exportar CSV"
              >
                <Download size={12} /> CSV
              </button>
              {totalPages > 1 && (
                <>
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                  <span className="text-xs text-zinc-500">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-50">
            <input
              type="text"
              placeholder="Buscar campanha..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              aria-label="Filtrar campanhas"
              className="w-full sm:w-56 px-3 py-1.5 text-sm border rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <div className="flex gap-1">
              {[
                { value: "all", label: "Todas" },
                { value: "ACTIVE", label: "Ativas" },
                { value: "PAUSED", label: "Pausadas" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFilterStatus(opt.value); setPage(0); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === opt.value ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] text-zinc-500">
                  <th className="py-2.5 px-5 text-left w-8">#</th>
                  <th className="py-2.5 pr-2 text-left">Campanha</th>
                  <th className="py-2.5 px-2 text-left w-28">Objetivo</th>
                  <th className="py-2.5 px-2 text-center w-16">Status</th>
                  <SortableHeader label="Invest." field="spend" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Conv" field="conversions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-14" />
                  <SortableHeader label="Receita" field="revenue" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="CPA" field="cpa" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="ROAS" field="roas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                  <SortableHeader label="Impr." field="impressions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Cliques" field="clicks" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {pageCampaigns.length === 0 && (
                  <tr><td colSpan={11} className="py-8 text-center text-zinc-400 text-sm">
                    {searchQuery || filterStatus !== "all"
                      ? `Nenhuma campanha encontrada${searchQuery ? ` para "${searchQuery}"` : ""}`
                      : "Nenhuma campanha disponível para o período."}
                  </td></tr>
                )}
                {pageCampaigns.map((c, i) => (
                  <tr key={c.campaignId} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <td className="py-2 px-5 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                    <td className="py-2 pr-2 max-w-[220px] truncate text-zinc-700" title={c.campaignName}>{c.campaignName}</td>
                    <td className="py-2 px-2 text-xs text-zinc-500">{formatObjective(c.objective)}</td>
                    <td className="py-2 px-2 text-center"><MetaStatusBadge status={c.status} /></td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(c.spend)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtConv(c.conversions)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(c.revenue)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{c.conversions > 0 ? formatBRL(c.cpa) : "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{c.roas > 0 ? c.roas.toFixed(1) : "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{c.impressions.toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-5 text-right tabular-nums">{c.clicks.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
              {filteredCampaigns.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 font-semibold text-zinc-700 bg-zinc-50">
                    <td className="py-2.5 px-5" colSpan={4}>Total</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(tableTotals.spend)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{fmtConv(tableTotals.conversions)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatBRL(tableTotals.revenue)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{tableTotals.conversions > 0 ? formatBRL(tableTotals.spend / tableTotals.conversions) : "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{tableTotals.spend > 0 ? (tableTotals.revenue / tableTotals.spend).toFixed(1) : "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{tableTotals.impressions.toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 px-5 text-right tabular-nums">{tableTotals.clicks.toLocaleString("pt-BR")}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 py-3 border-t border-zinc-100">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
              <span className="text-xs text-zinc-500 flex items-center">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
            </div>
          )}
        </div>
      )}

      {/* ─── DISCLAIMER ─── */}
      {data && !notConfigured && (
        <p className="text-xs text-zinc-400 text-center">
          Dados obtidos via Meta Marketing API. Atualizado em {data.updatedAt ? new Date(data.updatedAt).toLocaleString("pt-BR") : "—"}.
        </p>
      )}
    </div>
  );
}

// ---------- Helpers ----------

function formatObjective(obj: string): string {
  const map: Record<string, string> = {
    OUTCOME_TRAFFIC: "Tráfego",
    OUTCOME_ENGAGEMENT: "Engajamento",
    OUTCOME_LEADS: "Leads",
    OUTCOME_SALES: "Vendas",
    OUTCOME_AWARENESS: "Reconhecimento",
    OUTCOME_APP_PROMOTION: "App",
    LINK_CLICKS: "Cliques",
    CONVERSIONS: "Conversões",
    POST_ENGAGEMENT: "Engajamento",
    REACH: "Alcance",
    BRAND_AWARENESS: "Reconhecimento",
    VIDEO_VIEWS: "Vídeo",
    LEAD_GENERATION: "Leads",
    MESSAGES: "Mensagens",
    CATALOG_SALES: "Catálogo",
    STORE_VISITS: "Visitas",
    PRODUCT_CATALOG_SALES: "Catálogo",
  };
  return map[obj] ?? obj.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function MetaStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Ativa" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" title={status} />;
}
