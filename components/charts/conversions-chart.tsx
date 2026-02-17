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

const ConversionsChart = React.memo(function ConversionsChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            Number(value ?? 0).toLocaleString("pt-BR"),
            name === "conversions" ? "Conversões" : "CPC (R$)",
          ]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => (value === "conversions" ? "Conversões" : "CPC (R$)")} />
        <Bar dataKey="conversions" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="cpc"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          yAxisId={0}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
export default ConversionsChart;
