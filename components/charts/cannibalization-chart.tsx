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
import type { CannibalizationEntry } from "@/lib/organic-types";

export default function CannibalizationChart({ data }: { data: CannibalizationEntry[] }) {
  const top10 = data.slice(0, 10).map((entry) => ({
    keyword: entry.keyword.length > 25 ? entry.keyword.slice(0, 25) + "..." : entry.keyword,
    orgClicks: entry.organicClicks,
    paidClicks: entry.paidClicks,
    savings: entry.estimatedSavingsBRL,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={top10} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="keyword" width={160} tick={{ fontSize: 10 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "Economia Est.") return [`R$ ${Number(value).toFixed(2)}`, name];
            return [Number(value).toLocaleString("pt-BR"), name];
          }}
        />
        <Legend />
        <Bar dataKey="orgClicks" fill="#10b981" name="Cliques Org." radius={[0, 2, 2, 0]} />
        <Bar dataKey="paidClicks" fill="#3b82f6" name="Cliques Pagos" radius={[0, 2, 2, 0]} />
        <Bar dataKey="savings" fill="#f59e0b" name="Economia Est." radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
