"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartPoint } from "./chart-types";

const RoasChart = React.memo(function RoasChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [Number(value ?? 0).toFixed(2), "ROAS"]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        {/* Linha de meta ROAS 7 */}
        <Line
          type="monotone"
          dataKey={() => 7}
          stroke="#d4d4d8"
          strokeDasharray="5 5"
          strokeWidth={1}
          dot={false}
          name="Meta (7,0)"
        />
        {/* Linha de pausa ROAS 5 */}
        <Line
          type="monotone"
          dataKey={() => 5}
          stroke="#fca5a5"
          strokeDasharray="3 3"
          strokeWidth={1}
          dot={false}
          name="Pausa (5,0)"
        />
        <Line
          type="monotone"
          dataKey="roas"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#3b82f6" }}
          name="ROAS"
        />
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
});
export default RoasChart;
