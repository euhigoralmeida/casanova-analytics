"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartPoint } from "./chart-types";

export default function RevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            name === "revenue" ? "Receita" : "Gasto Ads",
          ]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => (value === "revenue" ? "Receita" : "Gasto Ads")} />
        <Area
          type="monotone"
          dataKey="revenue"
          fill="#d1fae5"
          stroke="#10b981"
          strokeWidth={2}
          fillOpacity={0.4}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
