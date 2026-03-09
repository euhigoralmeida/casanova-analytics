"use client";

import { useState } from "react";
import type { CustomersByActionMonth } from "@/lib/crm-engine";
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

const ACTION_COLORS = {
  retidos: "#b8ccc4",
  reativados: "#7a9e8e",
  recuperados: "#2d4a3e",
  novos: "#2563eb",
};

const ACTION_LABELS: Record<string, string> = {
  retidos: "Retidos (< 60d)",
  reativados: "Reativados (entre 60d e 90d)",
  recuperados: "Recuperados (> 90d)",
  novos: "Novos (1a Compra)",
};

const ACTION_KEYS: (keyof typeof ACTION_COLORS)[] = ["retidos", "reativados", "recuperados", "novos"];
const STACKED_KEYS: (keyof typeof ACTION_COLORS)[] = ["retidos", "reativados", "recuperados"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (!value || value === 0 || height < 14) return null;
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

export function CustomersByActionChart({ data }: { data: CustomersByActionMonth[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggleSeries(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleStacked = STACKED_KEYS.filter((k) => !hidden.has(k));
  const topStackedKey = visibleStacked.length > 0 ? visibleStacked[visibleStacked.length - 1] : null;

  return (
    <>
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide text-center mb-2">
        Clientes por Acao
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mb-4">
        {ACTION_KEYS.map((key) => {
          const isHidden = hidden.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${isHidden ? "opacity-35" : "opacity-100"}`}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: ACTION_COLORS[key] }}
              />
              <span className="text-zinc-600">{ACTION_LABELS[key]}</span>
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={320}>
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
            formatter={(value: any, name: any) => [value, ACTION_LABELS[name as string] || name]}
            contentStyle={{ fontSize: 12 }}
          />
          {STACKED_KEYS.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="returning"
              fill={ACTION_COLORS[key]}
              hide={hidden.has(key)}
              radius={key === topStackedKey ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              label={!hidden.has(key) ? <BarLabel /> : undefined}
            />
          ))}
          <Bar
            dataKey="novos"
            fill={ACTION_COLORS.novos}
            hide={hidden.has("novos")}
            radius={[4, 4, 0, 0]}
            label={!hidden.has("novos") ? <BarLabel /> : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AprovBarLabel(props: any) {
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
      {Number(value).toFixed(2)}
    </text>
  );
}

export function TaxaAproveitamentoChart({ data }: { data: CustomersByActionMonth[] }) {
  const chartData = data.map((d) => {
    const returning = d.retidos + d.reativados + d.recuperados;
    const total = returning + d.novos;
    const taxa = total > 0 ? Math.round((returning / total) * 10000) / 100 : 0;
    return { month: d.month, taxa };
  });

  return (
    <>
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide text-center mb-2">
        Taxa de Aproveitamento
      </h2>
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: PIE_LIGHT }} />
        <span className="text-xs text-zinc-600">Taxa de aproveitamento</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
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
            formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "Taxa de aproveitamento"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="taxa" fill={PIE_LIGHT} radius={[4, 4, 0, 0]} label={<AprovBarLabel />} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
