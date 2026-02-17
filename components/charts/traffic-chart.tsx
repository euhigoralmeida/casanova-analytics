"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartPoint } from "./chart-types";

const TrafficChart = React.memo(function TrafficChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const v = Number(value ?? 0);
            if (name === "ctr") return [`${v.toFixed(2)}%`, "CTR"];
            return [v.toLocaleString("pt-BR"), name === "impressions" ? "Impressões" : "Cliques"];
          }}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => {
          if (value === "impressions") return "Impressões";
          if (value === "clicks") return "Cliques";
          return "CTR (%)";
        }} />
        <Area
          type="monotone"
          dataKey="impressions"
          fill="#e0f2fe"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          fillOpacity={0.3}
          yAxisId="left"
        />
        <Bar dataKey="clicks" fill="#6366f1" radius={[2, 2, 0, 0]} yAxisId="left" />
        <Line
          type="monotone"
          dataKey="ctr"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={false}
          yAxisId="right"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
export default TrafficChart;
