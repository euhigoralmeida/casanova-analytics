"use client";

import type { TimeToRepurchase } from "@/lib/crm-engine";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export function TimeToRepurchaseChart({ data }: { data: TimeToRepurchase }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data.buckets}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value).toLocaleString("pt-BR")} clientes`, "Clientes"]}
        />
        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
