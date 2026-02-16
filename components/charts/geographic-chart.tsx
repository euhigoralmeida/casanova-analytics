"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { GeographicSlice } from "@/lib/intelligence/data-layer/types";
import { formatBRL } from "@/lib/format";

interface GeographicChartProps {
  data: GeographicSlice[];
  maxRegions?: number;
}

function roasFill(roas: number): string {
  if (roas >= 7) return "#10b981";
  if (roas >= 5) return "#f59e0b";
  return "#ef4444";
}

export default function GeographicChart({ data, maxRegions = 10 }: GeographicChartProps) {
  const chartData = data
    .filter((d) => d.revenue > 0)
    .slice(0, maxRegions)
    .map((d) => ({
      name: d.region.length > 20 ? d.region.slice(0, 18) + "…" : d.region,
      fullName: d.region,
      receita: Math.round(d.revenue),
      roas: d.roas,
      share: d.revenueShare,
      fill: roasFill(d.roas),
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" barSize={16}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "receita") return [formatBRL(value), "Receita"];
            return [value, name];
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => {
            const item = chartData.find((d) => d.name === label);
            return `${item?.fullName ?? label} — ROAS ${item?.roas.toFixed(1)} (${item?.share.toFixed(0)}%)`;
          }}
        />
        <Bar
          dataKey="receita"
          radius={[0, 4, 4, 0]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shape={(props: any) => {
            const { fill: _fill, ...rest } = props;
            return <rect {...rest} fill={props.payload.fill} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
