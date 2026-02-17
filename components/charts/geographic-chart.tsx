"use client";

import React from "react";
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
import type { RechartsFormatter } from "@/types/api";
import { formatBRL } from "@/lib/format";

interface GeographicChartProps {
  data: GeographicSlice[];
  maxRegions?: number;
}

const GeographicChart = React.memo(function GeographicChart({ data, maxRegions = 10 }: GeographicChartProps) {
  const chartData = data
    .filter((d) => d.revenue > 0 || (d.sessions ?? 0) > 0)
    .slice(0, maxRegions)
    .map((d) => ({
      name: d.region.length > 20 ? d.region.slice(0, 18) + "…" : d.region,
      fullName: d.region,
      receita: Math.round(d.revenue),
      sessoes: d.sessions ?? 0,
      share: d.revenueShare,
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
          formatter={((value: unknown, name: unknown) => {
            if (name === "receita") return [formatBRL(Number(value)), "Receita"];
            if (name === "sessoes") return [Number(value).toLocaleString("pt-BR"), "Sessões"];
            return [String(value), String(name)];
          }) as RechartsFormatter}
          labelFormatter={(label: unknown) => {
            const item = chartData.find((d) => d.name === label);
            return `${item?.fullName ?? label} (${item?.share.toFixed(0)}%)`;
          }}
        />
        <Bar dataKey="receita" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});
export default GeographicChart;
