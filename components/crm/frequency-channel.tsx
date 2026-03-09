"use client";

import { formatBRL, formatPct } from "@/lib/format";
import type { FrequencyBucket, ChannelAttribution } from "@/lib/crm-engine";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHANNEL_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#6b7280"];

export function FrequencyChart({ data }: { data: FrequencyBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value).toLocaleString("pt-BR")} clientes`, "Clientes"]}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChannelSection({ data }: { data: ChannelAttribution[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [formatBRL(Number(value)), "Receita"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-2 py-1.5 font-medium">Canal</th>
              <th className="px-2 py-1.5 font-medium text-right">Pedidos</th>
              <th className="px-2 py-1.5 font-medium text-right">Receita</th>
              <th className="px-2 py-1.5 font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.channel} className="border-t border-zinc-100">
                <td className="px-2 py-1.5 text-zinc-700">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                  {d.channel}
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-600">{d.orders.toLocaleString("pt-BR")}</td>
                <td className="px-2 py-1.5 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
                <td className="px-2 py-1.5 text-right text-zinc-600">{formatPct(d.percentage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
