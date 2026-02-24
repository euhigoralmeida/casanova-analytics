"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
} from "recharts";
import type { ScoredKeyword } from "@/lib/organic-types";

const classificationColors: Record<string, string> = {
  proteger: "#10b981",
  escalar: "#3b82f6",
  recuperar: "#f59e0b",
  testar: "#8b5cf6",
  ignorar: "#9ca3af",
};

export default function KeywordPositionChart({
  data,
  filter,
}: {
  data: ScoredKeyword[];
  filter?: string;
}) {
  const filtered = filter && filter !== "todos"
    ? data.filter((k) => k.classification === filter)
    : data;

  // Group by classification for different scatter colors
  const groups = new Map<string, typeof filtered>();
  for (const kw of filtered.slice(0, 100)) {
    const cls = kw.classification;
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls)!.push(kw);
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          dataKey="position"
          name="Posicao"
          reversed
          domain={[1, 50]}
          tick={{ fontSize: 11 }}
          label={{ value: "Posicao", position: "insideBottom", offset: -5, fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="estimatedRevenue"
          name="Receita Est."
          tick={{ fontSize: 11 }}
          label={{ value: "Receita Est. (R$)", angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="score" range={[30, 200]} name="Score" />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "Receita Est.") return [`R$ ${Number(value).toFixed(2)}`, name];
            if (name === "Score") return [Number(value).toFixed(0), name];
            return [Number(value).toFixed(1), name];
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => `Posicao: ${label}`}
        />
        {Array.from(groups.entries()).map(([cls, items]) => (
          <Scatter
            key={cls}
            name={cls.charAt(0).toUpperCase() + cls.slice(1)}
            data={items}
            fill={classificationColors[cls] ?? "#9ca3af"}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
