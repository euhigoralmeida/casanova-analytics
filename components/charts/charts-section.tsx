"use client";

import { useMemo, useState } from "react";
import type { TimeSeriesResponse, GA4DataResponse } from "@/types/api";
import type { ChartTab } from "./chart-types";
import { chartTabs } from "./chart-types";
import RevenueChart from "./revenue-chart";
import RoasChart from "./roas-chart";
import ConversionsChart from "./conversions-chart";
import TrafficChart from "./traffic-chart";
import CpmClicksChart from "./cpm-clicks-chart";
import QuarterVsSemester from "./quarter-vs-semester";
import GA4FunnelChart from "./ga4-funnel-chart";

export default function ChartsSection({ data, ga4Data }: { data: TimeSeriesResponse; ga4Data?: GA4DataResponse | null }) {
  const [tab, setTab] = useState<ChartTab>("receita");

  // Formatar datas para exibição (dd/mm)
  const chartData = useMemo(() => data.series.map((p) => ({
    ...p,
    label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
    cpm: p.impressions > 0 ? Math.round((p.cost / p.impressions) * 1000 * 100) / 100 : 0,
  })), [data]);

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Tendências</h2>
        <div className="flex gap-1">
          {chartTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                tab === t.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "trimestre" ? (
        <QuarterVsSemester />
      ) : tab === "funilga4" ? (
        ga4Data && ga4Data.source === "ga4" && ga4Data.dailySeries && ga4Data.dailySeries.length > 1 ? (
          <GA4FunnelChart data={ga4Data.dailySeries} />
        ) : (
          <p className="text-sm text-zinc-400 text-center py-12">
            {ga4Data?.source === "not_configured"
              ? "GA4 não configurado. Configure as credenciais GA4 no .env.local para ver os dados do funil."
              : "Sem dados GA4 para o período selecionado."}
          </p>
        )
      ) : (
        <div className="h-72">
          {tab === "receita" && <RevenueChart data={chartData} />}
          {tab === "roas" && <RoasChart data={chartData} />}
          {tab === "conversoes" && <ConversionsChart data={chartData} />}
          {tab === "trafego" && <TrafficChart data={chartData} />}
          {tab === "cpmclicks" && <CpmClicksChart data={chartData} />}
        </div>
      )}
    </section>
  );
}
