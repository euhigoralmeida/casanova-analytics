"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "@/types/api";
import type { IntelligenceResponse } from "@/lib/intelligence/types";
import type { CognitiveResponse } from "@/lib/intelligence/communication/types";
import type { DeviceSlice, DemographicSlice, GeographicSlice } from "@/lib/intelligence/data-layer/types";
import { defaultRange } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import DeviceChart from "@/components/charts/device-chart";
import DemographicChart from "@/components/charts/demographic-chart";
import GeographicChart from "@/components/charts/geographic-chart";
import { Monitor, Users, MapPin } from "lucide-react";

type Tab = "device" | "demographic" | "geographic";

const AGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: "18-24",
  AGE_RANGE_25_34: "25-34",
  AGE_RANGE_35_44: "35-44",
  AGE_RANGE_45_54: "45-54",
  AGE_RANGE_55_64: "55-64",
  AGE_RANGE_65_UP: "65+",
  AGE_RANGE_UNDETERMINED: "N/D",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  UNDETERMINED: "N/D",
};

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  CONNECTED_TV: "TV",
  OTHER: "Outro",
};

function KpiCard({ label, value, sublabel, color }: { label: string; value: string; sublabel?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color ?? "text-zinc-900"}`}>{value}</p>
      {sublabel && <p className="text-[10px] text-zinc-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function roasColor(roas: number): string {
  if (roas >= 7) return "text-emerald-600";
  if (roas >= 5) return "text-amber-600";
  return "text-red-600";
}

export default function SegmentsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<DeviceSlice[]>([]);
  const [demographics, setDemographics] = useState<DemographicSlice[]>([]);
  const [geographic, setGeographic] = useState<GeographicSlice[]>([]);
  const [tab, setTab] = useState<Tab>("device");
  const [demoSubTab, setDemoSubTab] = useState<"age" | "gender">("age");

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", range.preset ?? "custom");
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);

      const res = await fetch(`/api/intelligence?${params.toString()}`);
      if (res.ok) {
        const data: IntelligenceResponse & Partial<CognitiveResponse> = await res.json();
        setDevices(data.segmentation?.devices ?? []);
        setDemographics(data.segmentation?.demographics ?? []);
        setGeographic(data.segmentation?.geographic ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "device", label: "Dispositivo", icon: <Monitor className="h-3.5 w-3.5" /> },
    { key: "demographic", label: "Demografia", icon: <Users className="h-3.5 w-3.5" /> },
    { key: "geographic", label: "Geografia", icon: <MapPin className="h-3.5 w-3.5" /> },
  ];

  // Device KPIs
  const totalDeviceRevenue = devices.reduce((s, d) => s + d.revenue, 0);
  const totalDeviceSpend = devices.reduce((s, d) => s + d.costBRL, 0);
  const bestDevice = [...devices].sort((a, b) => b.roas - a.roas)[0];

  // Demo KPIs
  const ageSlices = demographics.filter((d) => d.type === "age" && d.segment !== "AGE_RANGE_UNDETERMINED");
  const genderSlices = demographics.filter((d) => d.type === "gender" && d.segment !== "UNDETERMINED");

  // Geo KPIs
  const totalGeoRevenue = geographic.reduce((s, d) => s + d.revenue, 0);
  const topRegion = geographic[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Segmentação</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Análise por dispositivo, demografia e geografia
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-zinc-400 py-8 text-center">Carregando dados de segmentação...</div>
      )}

      {/* Device Tab */}
      {tab === "device" && !loading && (
        <div className="space-y-4">
          {devices.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
              Sem dados de dispositivo disponíveis
            </div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Receita Total" value={formatBRL(totalDeviceRevenue)} />
                <KpiCard label="Investimento Total" value={formatBRL(totalDeviceSpend)} />
                <KpiCard
                  label="Melhor Dispositivo"
                  value={DEVICE_LABELS[bestDevice?.device] ?? "—"}
                  sublabel={bestDevice ? `ROAS ${bestDevice.roas.toFixed(1)}` : undefined}
                  color={bestDevice ? roasColor(bestDevice.roas) : undefined}
                />
                <KpiCard label="Dispositivos" value={String(devices.length)} sublabel="com dados" />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4">Receita vs Investimento por Dispositivo</h3>
                <div className="h-72">
                  <DeviceChart data={devices} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-800">Detalhamento por Dispositivo</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400">Dispositivo</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Receita</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Investimento</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">ROAS</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">CPA</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">CTR</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Conv Rate</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => (
                        <tr key={d.device} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                          <td className="px-4 py-2.5 font-medium text-zinc-700">{DEVICE_LABELS[d.device] ?? d.device}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{formatBRL(d.costBRL)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${roasColor(d.roas)}`}>{d.roas.toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{formatBRL(d.cpa)}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{d.ctr.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{d.convRate.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">{d.revenueShare.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Demographic Tab */}
      {tab === "demographic" && !loading && (
        <div className="space-y-4">
          {demographics.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
              Sem dados demográficos disponíveis
            </div>
          ) : (
            <>
              {/* Sub-tabs: Age / Gender */}
              <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => setDemoSubTab("age")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    demoSubTab === "age" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  Faixa Etária
                </button>
                <button
                  onClick={() => setDemoSubTab("gender")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    demoSubTab === "gender" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  Gênero
                </button>
              </div>

              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {demoSubTab === "age" ? (
                  <>
                    <KpiCard label="Faixas Etárias" value={String(ageSlices.length)} sublabel="com dados" />
                    <KpiCard
                      label="Maior Receita"
                      value={AGE_LABELS[[...ageSlices].sort((a, b) => b.revenue - a.revenue)[0]?.segment] ?? "—"}
                      sublabel={ageSlices[0] ? formatBRL([...ageSlices].sort((a, b) => b.revenue - a.revenue)[0]?.revenue) : undefined}
                    />
                    <KpiCard
                      label="Receita Total"
                      value={formatBRL(ageSlices.reduce((s, a) => s + a.revenue, 0))}
                    />
                    <KpiCard
                      label="Sessões Total"
                      value={String(ageSlices.reduce((s, a) => s + (a.sessions ?? 0), 0).toLocaleString("pt-BR"))}
                    />
                  </>
                ) : (
                  <>
                    <KpiCard label="Gêneros" value={String(genderSlices.length)} sublabel="com dados" />
                    <KpiCard
                      label="Maior Receita"
                      value={GENDER_LABELS[[...genderSlices].sort((a, b) => b.revenue - a.revenue)[0]?.segment] ?? "—"}
                      sublabel={genderSlices[0] ? formatBRL([...genderSlices].sort((a, b) => b.revenue - a.revenue)[0]?.revenue) : undefined}
                    />
                    <KpiCard
                      label="Receita Total"
                      value={formatBRL(genderSlices.reduce((s, a) => s + a.revenue, 0))}
                    />
                    <KpiCard
                      label="Sessões Total"
                      value={String(genderSlices.reduce((s, a) => s + (a.sessions ?? 0), 0).toLocaleString("pt-BR"))}
                    />
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4">
                  Receita por {demoSubTab === "age" ? "Faixa Etária" : "Gênero"}
                </h3>
                <div className="h-72">
                  <DemographicChart data={demographics} view={demoSubTab} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-800">
                    Detalhamento por {demoSubTab === "age" ? "Faixa Etária" : "Gênero"}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400">Segmento</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Usuários</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Sessões</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Conversões</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Receita</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Conv Rate</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(demoSubTab === "age" ? ageSlices : genderSlices).map((d) => {
                        const lbl = demoSubTab === "age"
                          ? (AGE_LABELS[d.segment] ?? d.segment)
                          : (GENDER_LABELS[d.segment] ?? d.segment);
                        const convRate = (d.sessions ?? 0) > 0 ? (d.conversions / (d.sessions ?? 1)) * 100 : 0;
                        return (
                          <tr key={d.segment} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                            <td className="px-4 py-2.5 font-medium text-zinc-700">{lbl}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{(d.users ?? 0).toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{(d.sessions ?? 0).toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{d.conversions.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{convRate.toFixed(2)}%</td>
                            <td className="px-4 py-2.5 text-right text-zinc-500">{d.revenueShare.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Geographic Tab */}
      {tab === "geographic" && !loading && (
        <div className="space-y-4">
          {geographic.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
              Sem dados geográficos disponíveis
            </div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Receita Total" value={formatBRL(totalGeoRevenue)} />
                <KpiCard label="Regiões" value={String(geographic.length)} sublabel="com dados" />
                <KpiCard
                  label="Top Região"
                  value={topRegion?.region ?? "—"}
                  sublabel={topRegion ? `${topRegion.revenueShare.toFixed(0)}% da receita` : undefined}
                />
                <KpiCard
                  label="Sessões Top Região"
                  value={String((topRegion?.sessions ?? 0).toLocaleString("pt-BR"))}
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4">Top 10 Regiões por Receita</h3>
                <div className="h-80">
                  <GeographicChart data={geographic} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-800">Detalhamento por Região</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400">Região</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Usuários</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Sessões</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Conversões</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Receita</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Conv Rate</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geographic.map((d) => {
                        const convRate = (d.sessions ?? 0) > 0 ? (d.conversions / (d.sessions ?? 1)) * 100 : 0;
                        return (
                          <tr key={d.region} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                            <td className="px-4 py-2.5 font-medium text-zinc-700">{d.region}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{(d.users ?? 0).toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{(d.sessions ?? 0).toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{d.conversions.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">{convRate.toFixed(2)}%</td>
                            <td className="px-4 py-2.5 text-right text-zinc-500">{d.revenueShare.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
