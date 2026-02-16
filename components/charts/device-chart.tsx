"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DeviceSlice } from "@/lib/intelligence/data-layer/types";
import { formatBRL } from "@/lib/format";

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  CONNECTED_TV: "TV",
  OTHER: "Outro",
};

interface DeviceChartProps {
  data: DeviceSlice[];
}

export default function DeviceChart({ data }: DeviceChartProps) {
  const chartData = data
    .filter((d) => d.revenue > 0 || d.costBRL > 0)
    .map((d) => ({
      name: DEVICE_LABELS[d.device] ?? d.device,
      receita: Math.round(d.revenue),
      investimento: Math.round(d.costBRL),
      roas: d.roas,
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            formatBRL(value),
            name === "receita" ? "Receita" : "Investimento",
          ]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => {
            const item = chartData.find((d) => d.name === label);
            return `${label} — ROAS ${item?.roas.toFixed(1) ?? "0"}`;
          }}
        />
        <Legend
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => (value === "receita" ? "Receita" : "Investimento")}
        />
        <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="investimento" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
