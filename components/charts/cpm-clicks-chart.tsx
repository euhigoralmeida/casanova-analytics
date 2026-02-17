"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartPoint } from "./chart-types";
import type { RechartsFormatter } from "@/types/api";

const fmtCpm: RechartsFormatter = (value, name) => {
  const v = Number(value ?? 0);
  if (name === "cpm") return [`R$ ${v.toFixed(2)}`, "CPM"];
  return [v.toLocaleString("pt-BR"), "Cliques"];
};

const CpmClicksChart = React.memo(function CpmClicksChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `R$${v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <Tooltip
          formatter={fmtCpm}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => {
          if (value === "cpm") return "CPM (R$)";
          return "Cliques";
        }} />
        <Line
          type="monotone"
          dataKey="cpm"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          yAxisId="left"
        />
        <Bar dataKey="clicks" fill="#6366f1" radius={[2, 2, 0, 0]} yAxisId="right" />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
export default CpmClicksChart;
