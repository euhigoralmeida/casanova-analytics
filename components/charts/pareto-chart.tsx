"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { ParetoData } from "@/lib/crm-engine";

const ParetoChart = React.memo(function ParetoChart({
  data,
}: {
  data: ParetoData;
}) {
  if (!data.curve.length) {
    return (
      <div className="text-center py-8 text-sm text-zinc-400">
        Sem dados para curva Pareto.
      </div>
    );
  }

  const chartData = [{ customerPct: 0, revenuePct: 0 }, ...data.curve];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          dataKey="customerPct"
          tick={{ fontSize: 11 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tickFormatter={(v: any) => `${v}%`}
          label={{ value: "% Clientes", position: "insideBottom", offset: -2, fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tickFormatter={(v: any) => `${v}%`}
          label={{ value: "% Receita", angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${Number(value).toFixed(1)}%`,
            name === "revenuePct" ? "Receita acumulada" : name,
          ]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => `${label}% dos clientes`}
        />
        <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "80%", fontSize: 10, fill: "#f59e0b" }} />
        <ReferenceLine x={data.pct80Revenue} stroke="#f59e0b" strokeDasharray="5 5" />
        <Area
          type="monotone"
          dataKey="revenuePct"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export default ParetoChart;
