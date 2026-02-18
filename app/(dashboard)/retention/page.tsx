"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, RetentionData } from "@/types/api";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import CohortHeatmap from "@/components/charts/cohort-heatmap";
import RetentionCurveChart from "@/components/charts/retention-curve-chart";
import { exportToCSV } from "@/lib/export-csv";
import { RefreshCw, Download, Users, UserCheck, Repeat, DollarSign } from "lucide-react";

export default function RetentionPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/retention?startDate=${range.startDate}&endDate=${range.endDate}`);
      if (!res.ok) throw new Error("Erro ao carregar dados de retenção");
      setData(await res.json());
    } catch {
      setError("Erro ao carregar dados. Tente novamente ou aguarde alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  function handleExportLTV() {
    if (!data?.channelLTV?.length) return;
    exportToCSV(
      data.channelLTV,
      [
        { key: "channel", label: "Canal" },
        { key: "users", label: "Usuários" },
        { key: "revenue", label: "Receita" },
        { key: "purchases", label: "Compras" },
        { key: "revenuePerUser", label: "Receita/Usuário" },
        { key: "purchasesPerUser", label: "Compras/Usuário" },
        { key: "avgTicket", label: "Ticket Médio" },
      ],
      `ltv-por-canal-${dateRange.startDate}-${dateRange.endDate}.csv`,
    );
  }

  const summary = data?.summary;
  const cohorts = data?.cohorts;
  const channelLTV = data?.channelLTV;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Retenção</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {data?.source === "ga4" && <span className="ml-2 text-zinc-400">GA4</span>}
            {data?.source === "not_configured" && <span className="ml-2 text-zinc-400">Mock</span>}
            {loading && <span className="ml-2 text-zinc-400">Atualizando...</span>}
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
          <button
            onClick={() => loadData(dateRange)}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ─── LOADING SKELETON ─── */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse mb-3" />
                <div className="h-7 w-24 bg-zinc-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse mb-4" />
            <div className="h-48 bg-zinc-100 rounded animate-pulse" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-4 w-40 bg-zinc-200 rounded animate-pulse mb-4" />
            <div className="h-64 bg-zinc-100 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* ─── DATA ─── */}
      {data && summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-zinc-400" />
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Usuários Totais</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900">{summary.totalUsers.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {summary.newUsers.toLocaleString("pt-BR")} novos · {summary.returningUsers.toLocaleString("pt-BR")} retornantes
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Taxa de Retorno</p>
              </div>
              <p className={`text-2xl font-bold ${summary.returnRate >= 25 ? "text-emerald-600" : summary.returnRate >= 15 ? "text-amber-600" : "text-red-600"}`}>
                {summary.returnRate.toFixed(1).replace(".", ",")}%
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {summary.avgSessionsPerUser.toFixed(1).replace(".", ",")} sessões/usuário
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">LTV Médio</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {formatBRL(summary.totalUsers > 0 ? summary.revenue / summary.totalUsers : 0)}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Ticket: {formatBRL(summary.avgOrderValue)}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="h-4 w-4 text-purple-500" />
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Freq. Compra</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {summary.repurchaseEstimate.toFixed(2).replace(".", ",")}x
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {summary.purchases.toLocaleString("pt-BR")} compras totais
              </p>
            </div>
          </div>

          {/* Novos vs Retornantes */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-4">Novos vs Retornantes</h2>
            <div className="flex items-center gap-4">
              {/* Stacked bar */}
              <div className="flex-1">
                <div className="flex h-8 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 flex items-center justify-center transition-all"
                    style={{ width: `${summary.totalUsers > 0 ? ((summary.newUsers / summary.totalUsers) * 100) : 50}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">
                      {summary.totalUsers > 0 ? ((summary.newUsers / summary.totalUsers) * 100).toFixed(0) : "—"}%
                    </span>
                  </div>
                  <div
                    className="bg-emerald-500 flex items-center justify-center transition-all"
                    style={{ width: `${summary.totalUsers > 0 ? ((summary.returningUsers / summary.totalUsers) * 100) : 50}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">
                      {summary.totalUsers > 0 ? ((summary.returningUsers / summary.totalUsers) * 100).toFixed(0) : "—"}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-zinc-600">Novos ({summary.newUsers.toLocaleString("pt-BR")})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-600">Retornantes ({summary.returningUsers.toLocaleString("pt-BR")})</span>
                  </div>
                </div>
              </div>

              {/* Revenue split estimate */}
              <div className="hidden sm:flex flex-col items-center gap-1 min-w-[140px] px-4 border-l border-zinc-100">
                <p className="text-[10px] font-medium text-zinc-400 uppercase">Receita Total</p>
                <p className="text-lg font-bold text-zinc-900">{formatBRL(summary.revenue)}</p>
                <p className="text-[10px] text-zinc-400">{summary.purchases.toLocaleString("pt-BR")} compras</p>
              </div>
            </div>
          </div>

          {/* Cohort Heatmap */}
          {cohorts && cohorts.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-zinc-800">Heatmap de Cohort</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {cohorts.length} semanas
                </span>
              </div>
              <CohortHeatmap data={cohorts} />
              <p className="text-[10px] text-zinc-400 mt-3">
                Cada linha representa um grupo de usuários que iniciou no mesmo período. As colunas mostram a % que retornou nas semanas seguintes.
              </p>
            </div>
          )}

          {/* Curva de Retenção */}
          {cohorts && cohorts.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-800 mb-4">Curva de Retenção</h2>
              <RetentionCurveChart data={cohorts} benchmark={20} />
              <p className="text-[10px] text-zinc-400 mt-2">
                Média de retenção de todos os cohorts por semana. Linha pontilhada = meta de 20%.
              </p>
            </div>
          )}

          {/* LTV por Canal */}
          {channelLTV && channelLTV.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">LTV por Canal de Aquisição</h3>
                <button
                  onClick={handleExportLTV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                      <th className="px-5 py-3 font-medium">Canal</th>
                      <th className="px-3 py-3 font-medium text-right">Usuários</th>
                      <th className="px-3 py-3 font-medium text-right">Receita</th>
                      <th className="px-3 py-3 font-medium text-right">Compras</th>
                      <th className="px-3 py-3 font-medium text-right">Receita/Usuário</th>
                      <th className="px-3 py-3 font-medium text-right">Compras/Usuário</th>
                      <th className="px-5 py-3 font-medium text-right">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...channelLTV]
                      .sort((a, b) => b.revenuePerUser - a.revenuePerUser)
                      .map((ch, idx) => {
                        const rpuColor =
                          ch.revenuePerUser >= 20 ? "text-emerald-700 bg-emerald-50" :
                          ch.revenuePerUser >= 10 ? "text-amber-700 bg-amber-50" :
                          "text-red-700 bg-red-50";
                        return (
                          <tr key={ch.channel} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                            <td className="px-5 py-2.5">
                              <span className="inline-flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-400">{idx + 1}.</span>
                                <span className="text-xs font-medium text-zinc-700">{ch.channel}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.users.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-zinc-800">{formatBRL(ch.revenue)}</td>
                            <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.purchases.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rpuColor}`}>
                                {formatBRL(ch.revenuePerUser)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-zinc-600">
                              {ch.purchasesPerUser.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="px-5 py-2.5 text-right text-xs text-zinc-600">{formatBRL(ch.avgTicket)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
