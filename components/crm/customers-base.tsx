"use client";

import { formatPct } from "@/lib/format";
import type { FrequencyBucket } from "@/lib/crm-engine";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const PIE_DARK = "#2d4a3e";
const PIE_LIGHT = "#b8ccc4";

export function ClientesBasePie({ repurchaseRate }: { repurchaseRate: number }) {
  const pieData = [
    { name: "Base", value: repurchaseRate },
    { name: "Novos", value: 100 - repurchaseRate },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col items-center">
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide mb-1">
        Clientes da Base ({formatPct(repurchaseRate)})
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={85}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={PIE_DARK} />
            <Cell fill={PIE_LIGHT} />
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-500 mt-1">Clientes com 2+ compras no periodo</p>
    </div>
  );
}

export function RetentionCurve({ frequencyBuckets }: { frequencyBuckets: FrequencyBucket[] }) {
  const totalCustomers = frequencyBuckets.reduce((s, b) => s + b.count, 0);
  if (totalCustomers === 0) return null;

  const curveData: { label: string; pct: number }[] = [];
  let cumulative = totalCustomers;

  for (const bucket of frequencyBuckets) {
    const pct = Math.round((cumulative / totalCustomers) * 1000) / 10;
    curveData.push({ label: bucket.label.replace(" compra", "").replace(" compras", ""), pct });
    cumulative -= bucket.count;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide text-center mb-3">
        Curva de Retencao
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={curveData} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
          <defs>
            <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PIE_LIGHT} stopOpacity={0.8} />
              <stop offset="100%" stopColor={PIE_LIGHT} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={{ stroke: "#d4d4d8" }}
            tickLine={false}
            label={{ value: "Pedidos no periodo", position: "insideBottom", offset: -15, fontSize: 11, fill: "#a1a1aa" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={{ stroke: "#d4d4d8" }}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}`}
            label={{ value: "% de Clientes", angle: -90, position: "insideLeft", offset: 5, fontSize: 11, fill: "#a1a1aa" }}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "% De clientes"]}
          />
          <Area
            type="linear"
            dataKey="pct"
            stroke={PIE_DARK}
            strokeWidth={2}
            fill="url(#retentionFill)"
            dot={{ r: 4, fill: "#fff", stroke: PIE_DARK, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
