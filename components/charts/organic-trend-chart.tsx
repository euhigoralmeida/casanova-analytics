"use client";

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
import type { GSCDailyPoint } from "@/lib/organic-types";

export default function OrganicTrendChart({ data }: { data: GSCDailyPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: d.date.slice(5), // mm-dd
    ctrPct: Math.round(d.ctr * 10000) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "Cliques") return [Number(value).toLocaleString("pt-BR"), name];
            if (name === "Impressoes") return [Number(value).toLocaleString("pt-BR"), name];
            if (name === "CTR %") return [`${Number(value).toFixed(2)}%`, name];
            return [value, name];
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="clicks" fill="#10b981" name="Cliques" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="impressions" fill="#10b98133" name="Impressoes" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="ctrPct" stroke="#6366f1" strokeWidth={2} name="CTR %" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
