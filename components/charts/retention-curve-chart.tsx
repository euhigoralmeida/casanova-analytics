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
import type { CohortRetentionData } from "@/lib/ga4-queries";

type CurvePoint = {
  week: string;
  avgRetention: number;
  users: number;
};

function buildCurveData(cohorts: CohortRetentionData[]): CurvePoint[] {
  if (!cohorts.length) return [];

  const maxWeeks = Math.max(...cohorts.map((c) => c.retention.length));
  const points: CurvePoint[] = [];

  for (let w = 0; w < maxWeeks; w++) {
    const validCohorts = cohorts.filter(
      (c) => c.retention[w] !== undefined && c.retention[w] > 0
    );
    if (validCohorts.length === 0) continue;
    const avgRetention =
      Math.round(
        (validCohorts.reduce((sum, c) => sum + c.retention[w], 0) / validCohorts.length) * 100
      ) / 100;
    const avgUsers = Math.round(
      validCohorts.reduce((sum, c) => sum + Math.round((c.usersStart * c.retention[w]) / 100), 0) /
        validCohorts.length
    );
    points.push({
      week: `Sem ${w}`,
      avgRetention,
      users: avgUsers,
    });
  }

  return points;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatter = (value: any, name: any) => [
  `${Number(value ?? 0).toFixed(1).replace(".", ",")}%`,
  name === "avgRetention" ? "Retenção Média" : String(name),
];

const RetentionCurveChart = React.memo(function RetentionCurveChart({
  data,
  benchmark = 20,
}: {
  data: CohortRetentionData[];
  benchmark?: number;
}) {
  const curveData = buildCurveData(data);

  if (curveData.length < 2) {
    return (
      <div className="text-center py-8 text-sm text-zinc-400">
        Dados insuficientes para gerar curva de retenção.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={curveData}>
        <defs>
          <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
        />
        <Tooltip
          formatter={tooltipFormatter}
          labelFormatter={(label: unknown) => String(label)}
        />
        <ReferenceLine
          y={benchmark}
          stroke="#f59e0b"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          label={{
            value: `Meta ${benchmark}%`,
            position: "insideTopRight",
            fill: "#d97706",
            fontSize: 10,
          }}
        />
        <Area
          type="monotone"
          dataKey="avgRetention"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#retentionGradient)"
          dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "#059669" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export default RetentionCurveChart;
