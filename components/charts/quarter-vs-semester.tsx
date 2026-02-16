"use client";

import { useState, useEffect } from "react";
import { formatBRL, fmtConv, fmtDate } from "@/lib/format";

type PeriodSummary = {
  revenue: number;
  ads: number;
  roas: number;
  conversions: number;
  clicks: number;
  impressions: number;
};

export default function QuarterVsSemester() {
  const [q, setQ] = useState<PeriodSummary | null>(null);
  const [s, setS] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const endDate = fmtDate(today);

    const q90Start = new Date(today);
    q90Start.setDate(q90Start.getDate() - 89);
    const q180Start = new Date(today);
    q180Start.setDate(q180Start.getDate() - 179);

    const fetchPeriod = async (start: string, end: string): Promise<PeriodSummary> => {
      const res = await fetch(`/api/overview?period=custom&startDate=${start}&endDate=${end}`);
      const json = await res.json();
      const totals = json.accountTotals ?? {
        ads: json.skus?.reduce((a: number, sk: { ads: number }) => a + sk.ads, 0) ?? 0,
        revenue: json.meta?.revenueActual ?? 0,
        conversions: json.skus?.reduce((a: number, sk: { conversions: number }) => a + sk.conversions, 0) ?? 0,
        impressions: 0,
        clicks: 0,
      };
      const roas = totals.ads > 0 ? Math.round((totals.revenue / totals.ads) * 100) / 100 : 0;
      return {
        revenue: totals.revenue,
        ads: totals.ads,
        roas,
        conversions: totals.conversions,
        clicks: totals.clicks ?? 0,
        impressions: totals.impressions ?? 0,
      };
    };

    Promise.all([
      fetchPeriod(fmtDate(q90Start), endDate),
      fetchPeriod(fmtDate(q180Start), endDate),
    ])
      .then(([quarter, semester]) => {
        if (!cancelled) {
          setQ(quarter);
          setS(semester);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72 text-zinc-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-2 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando comparativo...
      </div>
    );
  }

  if (!q || !s) {
    return <div className="flex items-center justify-center h-72 text-zinc-400 text-sm">Dados indisponiveis.</div>;
  }

  const metrics: { label: string; qVal: string; sVal: string; deltaPct: number }[] = [
    { label: "Receita", qVal: formatBRL(q.revenue), sVal: formatBRL(s.revenue), deltaPct: s.revenue > 0 ? Math.round(((q.revenue / (s.revenue / 2)) - 1) * 100) : 0 },
    { label: "Gasto Ads", qVal: formatBRL(q.ads), sVal: formatBRL(s.ads), deltaPct: s.ads > 0 ? Math.round(((q.ads / (s.ads / 2)) - 1) * 100) : 0 },
    { label: "ROAS", qVal: q.roas.toFixed(2), sVal: s.roas.toFixed(2), deltaPct: s.roas > 0 ? Math.round(((q.roas / s.roas) - 1) * 100) : 0 },
    { label: "Conversões", qVal: fmtConv(q.conversions), sVal: fmtConv(s.conversions), deltaPct: s.conversions > 0 ? Math.round(((q.conversions / (s.conversions / 2)) - 1) * 100) : 0 },
    { label: "CTR", qVal: q.impressions > 0 ? `${(q.clicks / q.impressions * 100).toFixed(2)}%` : "—", sVal: s.impressions > 0 ? `${(s.clicks / s.impressions * 100).toFixed(2)}%` : "—", deltaPct: 0 },
  ];

  // Recalcular delta do CTR separadamente
  const qCtr = q.impressions > 0 ? q.clicks / q.impressions * 100 : 0;
  const sCtr = s.impressions > 0 ? s.clicks / s.impressions * 100 : 0;
  metrics[4].deltaPct = sCtr > 0 ? Math.round(((qCtr / sCtr) - 1) * 100) : 0;

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-4">Comparativo proporcional: valores do trimestre vs metade do semestre (mesma base temporal)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {metrics.map((m) => {
          const isPositive = m.deltaPct > 0;
          const isNegative = m.deltaPct < 0;
          const isNeutral = m.deltaPct === 0;
          // Para "Gasto Ads", subir é ruim e descer é bom
          const invertColor = m.label === "Gasto Ads";
          const deltaColor = isNeutral
            ? "text-zinc-400 bg-zinc-100"
            : (isPositive && !invertColor) || (isNegative && invertColor)
              ? "text-emerald-700 bg-emerald-50"
              : "text-red-700 bg-red-50";

          return (
            <div key={m.label} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
              {/* Titulo + Delta */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{m.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${deltaColor}`}>
                  {isPositive ? "+" : ""}{m.deltaPct}%
                </span>
              </div>

              {/* Trimestre */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Trimestre (90d)</p>
                  <p className="text-base font-bold text-zinc-900">{m.qVal}</p>
                </div>
              </div>

              {/* Semestre */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Semestre (180d)</p>
                  <p className="text-base font-semibold text-zinc-500">{m.sVal}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
