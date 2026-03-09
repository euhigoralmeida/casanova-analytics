"use client";

import type { ActiveCustomersMonth } from "@/lib/crm-engine";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const PIE_LIGHT = "#b8ccc4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AtivosBarLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (!value || height < 14) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={11}
      fontWeight={700}
    >
      {value}
    </text>
  );
}

export function ClientesAtivosChart({ data }: { data: ActiveCustomersMonth[] }) {
  return (
    <>
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide text-center mb-1">
        Clientes Ativos
      </h2>
      <p className="text-xs text-zinc-500 text-center mb-2">
        Total de clientes com pelo menos uma compra nos 90 dias anteriores ao inicio de cada mes
      </p>
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: PIE_LIGHT }} />
        <span className="text-xs text-zinc-600">Clientes ativos</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={{ stroke: "#d4d4d8" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={{ stroke: "#d4d4d8" }}
            tickLine={false}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [value, "Clientes ativos"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="active" fill={PIE_LIGHT} radius={[4, 4, 0, 0]} label={<AtivosBarLabel />} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
