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
import { formatBRL } from "@/lib/format";
import type { GeoRow } from "@/lib/crm-engine";

const GeoChart = React.memo(function GeoChart({ data }: { data: GeoRow[] }) {
  if (!data.length) {
    return (
      <div className="text-center py-8 text-sm text-zinc-400">
        Sem dados geográficos.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(250, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tickFormatter={(v: any) => formatBRL(Number(v))}
        />
        <YAxis type="category" dataKey="uf" width={40} tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [formatBRL(Number(value)), "Receita"]}
        />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

export default GeoChart;
