"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, GA4DataResponse } from "@/types/api";
import { defaultRange } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      {/* PERÍODO */}
      <section className="grid gap-4 md:grid-cols-3">
        <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
        <div className="rounded-xl border bg-white p-4 md:col-span-2">
          <p className="text-sm text-zinc-600">Status</p>
          <p className="mt-2 text-sm">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-zinc-500">
                <svg className="animate-spin h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando...
              </span>
            ) : error ? error
              : ga4Data?.source === "not_configured" ? "GA4 não configurado"
              : ga4Data ? `Dados GA4 • ${dateRange.label}` : "Aguardando dados..."}
          </p>
        </div>
      </section>

      {/* ERRO */}
      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium">Tentar novamente</button>
        </section>
      )}

      {/* GA4 NÃO CONFIGURADO */}
      {ga4Data?.source === "not_configured" && (
        <section className="rounded-xl border bg-white p-8 text-center">
          <p className="text-lg font-semibold text-zinc-700 mb-2">GA4 não configurado</p>
          <p className="text-sm text-zinc-500">Configure as credenciais GA4 no .env.local para ver os dados do funil e-commerce.</p>
        </section>
      )}

      {/* FUNIL E-COMMERCE */}
      {ga4Data?.source === "ga4" && funnel && summary && (
        <section className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold">Funil E-commerce</h2>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">GA4</span>
            <span className="text-[11px] text-zinc-400 ml-auto">{dateRange.label}</span>
          </div>

          {/* Funil visual */}
          {(() => {
            const funnelColors = ["#3b82f6", "#6366f1", "#818cf8", "#8b5cf6", "#a855f7", "#c084fc", "#d946ef", "#e879f9", "#f472b6"];
            const maxCount = funnel[0]?.count || 1;
            return (
              <div className="overflow-x-auto mb-4">
                <div className="flex items-end gap-1 min-w-[700px]">
                  {funnel.map((step, i) => {
                    const heightPct = Math.max(15, (step.count / maxCount) * 100);
                    const isBottleneck = i === bottleneckIdx && step.dropoff > 20;
                    return (
                      <div key={step.eventName} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-medium text-zinc-600 mb-1 text-center leading-tight h-8 flex items-end justify-center">
                          {step.step}
                        </span>
                        <div
                          className={`w-full rounded-md flex items-center justify-center transition-all mx-0.5 ${isBottleneck ? "ring-2 ring-red-400 ring-offset-1" : ""}`}
                          style={{
                            height: `${Math.round(heightPct * 1.1)}px`,
                            background: `linear-gradient(180deg, ${funnelColors[i % funnelColors.length]}cc 0%, ${funnelColors[i % funnelColors.length]} 100%)`,
                          }}
                        >
                          <span className="text-white font-bold text-[11px]">
                            {step.count >= 1000 ? `${(step.count / 1000).toFixed(1).replace(".", ",")}k` : step.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {i > 0 && step.dropoff > 0 ? (
                          <span className={`text-[9px] mt-0.5 font-medium ${isBottleneck ? "text-red-600 font-bold" : "text-red-500"}`}>
                            -{step.dropoff.toFixed(1).replace(".", ",")}%
                            {isBottleneck && " ⚠"}
                          </span>
                        ) : i === 0 ? (
                          <span className="text-[9px] text-zinc-400 mt-0.5">entrada</span>
                        ) : (
                          <span className="text-[9px] text-zinc-300 mt-0.5">&nbsp;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Conversão geral */}
          <div className="text-center mb-4">
            <span className="text-xs text-zinc-500">Conversão geral ({funnel[0]?.step ?? "impressão"} → {funnel[funnel.length - 1]?.step ?? "purchase"}): </span>
            <span className="text-sm font-bold text-purple-700">{convRate.toFixed(2).replace(".", ",")}%</span>
          </div>

          {/* Resumo GA4 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Sessões</p>
              <p className="text-lg font-bold text-zinc-800">{summary.sessions.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Usuários</p>
              <p className="text-lg font-bold text-zinc-800">{summary.users.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Ticket Médio</p>
              <p className="text-lg font-bold text-zinc-800">{formatBRL(summary.avgOrderValue)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Receita (GA4)</p>
              <p className="text-lg font-bold text-zinc-800">{formatBRL(summary.purchaseRevenue)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Novos Usuários</p>
              <p className="text-lg font-bold text-zinc-800">{summary.newUsers.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Compras</p>
              <p className="text-lg font-bold text-zinc-800">{summary.purchases.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Abandono Carrinho</p>
              <p className="text-lg font-bold text-amber-600">{summary.cartAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center">
              <p className="text-[11px] text-zinc-500 mb-0.5">Abandono Checkout</p>
              <p className="text-lg font-bold text-amber-600">{summary.checkoutAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
            </div>
          </div>

          {/* Aquisição por Canal */}
          {channels && channels.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-zinc-700 mb-2">Aquisição de Usuários por Canal</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] text-zinc-500">
                      <th className="pb-2 font-medium">Canal</th>
                      <th className="pb-2 font-medium text-right">Usuários</th>
                      <th className="pb-2 font-medium text-right">Novos</th>
                      <th className="pb-2 font-medium text-right">Sessões</th>
                      <th className="pb-2 font-medium text-right">Conversões</th>
                      <th className="pb-2 font-medium text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch) => (
                      <tr key={ch.channel} className="border-b border-zinc-100 last:border-0">
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{
                              background: ch.channel === "Organic Search" ? "#10b981"
                                : ch.channel === "Paid Search" ? "#3b82f6"
                                : ch.channel === "Direct" ? "#6366f1"
                                : ch.channel === "Organic Social" ? "#f59e0b"
                                : ch.channel === "Paid Social" ? "#8b5cf6"
                                : ch.channel === "Referral" ? "#ec4899"
                                : ch.channel === "Email" ? "#ef4444"
                                : "#9ca3af"
                            }} />
                            <span className="text-xs font-medium text-zinc-700">{ch.channel}</span>
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-xs">{ch.users.toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 text-right text-xs">{ch.newUsers.toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 text-right text-xs">{ch.sessions.toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 text-right text-xs">{ch.conversions.toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 text-right text-xs font-medium">{formatBRL(ch.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* GRÁFICO DIÁRIO FUNIL */}
      {dailySeries && dailySeries.length > 1 && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold mb-4">Tendência Diária do Funil</h2>
          <GA4FunnelChart data={dailySeries} />
        </section>
      )}
    </div>
  );
}
