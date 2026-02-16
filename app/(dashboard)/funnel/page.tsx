"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, GA4DataResponse } from "@/types/api";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtDate } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import GA4FunnelChart from "@/components/charts/ga4-funnel-chart";

export default function FunilPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`);
      if (!res.ok) throw new Error("Erro ao carregar dados GA4");
      setGa4Data(await res.json());
    } catch {
      setError("Não foi possível carregar os dados do funil.");
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

  const funnel = ga4Data?.funnel;
  const summary = ga4Data?.summary;
  const convRate = ga4Data?.overallConversionRate ?? 0;
  const channels = ga4Data?.channelAcquisition;
  const dailySeries = ga4Data?.dailySeries;

  // Detect bottleneck (step with highest dropoff)
  const bottleneckIdx = funnel ? funnel.reduce((maxI, step, i, arr) =>
    i > 0 && step.dropoff > (arr[maxI]?.dropoff ?? 0) ? i : maxI, 1) : -1;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Funil E-commerce</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDate(new Date(dateRange.startDate + "T12:00:00")).split("-").reverse().join("/")} — {fmtDate(new Date(dateRange.endDate + "T12:00:00")).split("-").reverse().join("/")}
            {ga4Data?.source === "ga4" && <span className="ml-2 text-zinc-400">GA4</span>}
            {loading && <span className="ml-2 text-zinc-400">Carregando...</span>}
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
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium">Tentar novamente</button>
        </div>
      )}

      {/* ─── GA4 NÃO CONFIGURADO ─── */}
      {ga4Data?.source === "not_configured" && (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-lg font-semibold text-zinc-700 mb-2">GA4 não configurado</p>
          <p className="text-sm text-zinc-500">Configure as credenciais GA4 no .env.local para ver os dados do funil e-commerce.</p>
        </div>
      )}

      {/* ─── FUNIL E-COMMERCE ─── */}
      {ga4Data?.source === "ga4" && funnel && summary && (
        <>
          {/* Funil visual */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-sm font-semibold text-zinc-800">Funil de Conversão</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">GA4</span>
            </div>

            {(() => {
              const funnelColors = ["#3b82f6", "#6366f1", "#818cf8", "#8b5cf6", "#a855f7", "#c084fc", "#d946ef", "#e879f9", "#f472b6"];
              const maxCount = funnel[0]?.count || 1;
              return (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 min-w-[700px] px-2">
                    {funnel.map((step, i) => {
                      const heightPct = Math.max(15, (step.count / maxCount) * 100);
                      const isBottleneck = i === bottleneckIdx && step.dropoff > 20;
                      return (
                        <div key={step.eventName} className="flex-1 flex flex-col items-center">
                          <span className="text-[11px] font-medium text-zinc-600 mb-2 text-center leading-tight h-8 flex items-end justify-center">
                            {step.step}
                          </span>
                          <div
                            className={`w-full rounded-lg flex items-center justify-center transition-all ${isBottleneck ? "ring-2 ring-red-400 ring-offset-2" : ""}`}
                            style={{
                              height: `${Math.round(heightPct * 1.2)}px`,
                              background: `linear-gradient(180deg, ${funnelColors[i % funnelColors.length]}cc 0%, ${funnelColors[i % funnelColors.length]} 100%)`,
                            }}
                          >
                            <span className="text-white font-bold text-xs">
                              {step.count >= 1000 ? `${(step.count / 1000).toFixed(1).replace(".", ",")}k` : step.count.toLocaleString("pt-BR")}
                            </span>
                          </div>
                          {i > 0 && step.dropoff > 0 ? (
                            <span className={`text-[10px] mt-1.5 font-semibold ${isBottleneck ? "text-red-600" : "text-red-500"}`}>
                              -{step.dropoff.toFixed(1).replace(".", ",")}%
                              {isBottleneck && " ⚠"}
                            </span>
                          ) : i === 0 ? (
                            <span className="text-[10px] text-zinc-400 mt-1.5">entrada</span>
                          ) : (
                            <span className="text-[10px] text-zinc-300 mt-1.5">&nbsp;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Conversão geral */}
            <div className="text-center mt-5 pt-4 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">Conversão geral ({funnel[0]?.step ?? "impressão"} → {funnel[funnel.length - 1]?.step ?? "purchase"}): </span>
              <span className="text-sm font-bold text-purple-700">{convRate.toFixed(2).replace(".", ",")}%</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Sessões</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.sessions.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Usuários</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.users.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{summary.newUsers.toLocaleString("pt-BR")} novos</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Compras</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.purchases.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Ticket: {formatBRL(summary.avgOrderValue)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Receita GA4</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{formatBRL(summary.purchaseRevenue)}</p>
            </div>
          </div>

          {/* Abandono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Abandono Carrinho</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.cartAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Abandono Checkout</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.checkoutAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
            </div>
          </div>

          {/* Aquisição por Canal */}
          {channels && channels.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-800">Aquisição por Canal</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                      <th className="px-5 py-3 font-medium">Canal</th>
                      <th className="px-3 py-3 font-medium text-right">Usuários</th>
                      <th className="px-3 py-3 font-medium text-right">Novos</th>
                      <th className="px-3 py-3 font-medium text-right">Sessões</th>
                      <th className="px-3 py-3 font-medium text-right">Conversões</th>
                      <th className="px-5 py-3 font-medium text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch) => (
                      <tr key={ch.channel} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{
                              background: ch.channel === "Organic Search" ? "#10b981"
                                : ch.channel === "Paid Search" ? "#3b82f6"
                                : ch.channel === "Direct" ? "#6366f1"
                                : ch.channel === "Organic Social" ? "#f59e0b"
                                : ch.channel === "Paid Social" ? "#8b5cf6"
                                : ch.channel === "Referral" ? "#ec4899"
                                : ch.channel === "Email" ? "#ef4444"
                                : ch.channel === "Paid Shopping" ? "#14b8a6"
                                : ch.channel === "Organic Shopping" ? "#059669"
                                : "#9ca3af"
                            }} />
                            <span className="text-xs font-medium text-zinc-700">{ch.channel}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.users.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.newUsers.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.sessions.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.conversions.toLocaleString("pt-BR")}</td>
                        <td className="px-5 py-2.5 text-right text-xs font-semibold text-zinc-800">{formatBRL(ch.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── GRÁFICO DIÁRIO FUNIL ─── */}
      {dailySeries && dailySeries.length > 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Tendência Diária do Funil</h2>
          <GA4FunnelChart data={dailySeries} />
        </div>
      )}
    </div>
  );
}
