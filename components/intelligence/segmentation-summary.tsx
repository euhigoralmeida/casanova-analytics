"use client";

import type { DeviceSlice, DemographicSlice, GeographicSlice } from "@/lib/intelligence/data-layer/types";
import { Monitor, Smartphone, Tablet, Users, MapPin, ChevronRight, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/format";
import Link from "next/link";

interface SegmentationSummaryProps {
  segmentation: {
    devices: DeviceSlice[];
    demographics: DemographicSlice[];
    geographic: GeographicSlice[];
  };
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  DESKTOP: <Monitor className="h-3.5 w-3.5" />,
  MOBILE: <Smartphone className="h-3.5 w-3.5" />,
  TABLET: <Tablet className="h-3.5 w-3.5" />,
};

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  CONNECTED_TV: "TV",
  OTHER: "Outro",
};

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

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: "bg-blue-500",
  MOBILE: "bg-emerald-500",
  TABLET: "bg-amber-500",
};

function roasColor(roas: number): string {
  if (roas >= 7) return "text-emerald-600";
  if (roas >= 5) return "text-amber-600";
  return "text-red-600";
}

export function SegmentationSummary({ segmentation }: SegmentationSummaryProps) {
  const { devices, demographics, geographic } = segmentation;
  const hasDevices = devices.length > 0;
  const hasDemographics = demographics.length > 0;
  const hasGeographic = geographic.length > 0;

  if (!hasDevices && !hasDemographics && !hasGeographic) return null;

  // Device analysis
  const sortedDevices = [...devices].sort((a, b) => b.roas - a.roas);
  const bestDevice = sortedDevices[0];
  const totalDeviceRevenue = devices.reduce((s, d) => s + d.revenue, 0);

  // Demographics
  const ageSlices = demographics.filter((d) => d.type === "age" && d.segment !== "AGE_RANGE_UNDETERMINED");
  const genderSlices = demographics.filter((d) => d.type === "gender" && d.segment !== "UNDETERMINED");
  const bestAge = [...ageSlices].sort((a, b) => b.roas - a.roas)[0];
  const bestGender = [...genderSlices].sort((a, b) => b.roas - a.roas)[0];

  // Geographic
  const topRegions = geographic.slice(0, 3);
  const topConcentration = geographic[0]?.revenueShare ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800">Segmentação</h2>
        <Link
          href="/acquisition/segments"
          className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-0.5 transition-colors"
        >
          Ver detalhes <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {/* Device Card */}
        {hasDevices && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              <Monitor className="h-3 w-3" />
              Dispositivo
            </div>
            {bestDevice && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5">
                  {DEVICE_ICONS[bestDevice.device]}
                  <span className="text-sm font-semibold text-zinc-900">
                    {DEVICE_LABELS[bestDevice.device] ?? bestDevice.device}
                  </span>
                  <span className={`text-sm font-bold ${roasColor(bestDevice.roas)}`}>
                    ROAS {bestDevice.roas.toFixed(1)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {formatBRL(bestDevice.revenue)} ({bestDevice.revenueShare.toFixed(0)}% da receita)
                </p>
              </div>
            )}
            {/* Share bar */}
            {totalDeviceRevenue > 0 && (
              <div className="flex rounded-full overflow-hidden h-2 bg-zinc-100">
                {devices.filter((d) => d.revenueShare > 1).map((d) => (
                  <div
                    key={d.device}
                    className={`${DEVICE_COLORS[d.device] ?? "bg-zinc-400"} transition-all`}
                    style={{ width: `${d.revenueShare}%` }}
                    title={`${DEVICE_LABELS[d.device] ?? d.device}: ${d.revenueShare.toFixed(1)}%`}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-2">
              {devices.filter((d) => d.revenueShare > 1).map((d) => (
                <span key={d.device} className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${DEVICE_COLORS[d.device] ?? "bg-zinc-400"}`} />
                  {DEVICE_LABELS[d.device] ?? d.device} {d.revenueShare.toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Demographics Card */}
        {hasDemographics && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              <Users className="h-3 w-3" />
              Demografia
            </div>
            <div className="space-y-2">
              {bestAge && (
                <div>
                  <span className="text-[10px] text-zinc-400">Melhor faixa</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900">
                      {AGE_LABELS[bestAge.segment] ?? bestAge.segment}
                    </span>
                    <span className={`text-sm font-bold ${roasColor(bestAge.roas)}`}>
                      ROAS {bestAge.roas.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    {formatBRL(bestAge.revenue)} ({bestAge.revenueShare.toFixed(0)}% receita)
                  </p>
                </div>
              )}
              {bestGender && (
                <div>
                  <span className="text-[10px] text-zinc-400">Melhor gênero</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900">
                      {GENDER_LABELS[bestGender.segment] ?? bestGender.segment}
                    </span>
                    <span className={`text-sm font-bold ${roasColor(bestGender.roas)}`}>
                      ROAS {bestGender.roas.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Geographic Card */}
        {hasGeographic && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              <MapPin className="h-3 w-3" />
              Geografia
            </div>
            {topConcentration > 60 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium mb-2">
                <AlertTriangle className="h-3 w-3" />
                Concentração: {topConcentration.toFixed(0)}% em 1 região
              </div>
            )}
            <div className="space-y-1.5">
              {topRegions.map((r, i) => (
                <div key={r.region} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-zinc-400 w-3">{i + 1}</span>
                    <span className="text-xs text-zinc-700 truncate">{r.region}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-400">{r.revenueShare.toFixed(0)}%</span>
                    <span className={`text-[10px] font-semibold ${roasColor(r.roas)}`}>
                      {r.roas.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
