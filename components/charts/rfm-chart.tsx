"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { RFMDistribution } from "@/lib/crm-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderLabel = ({ segment, percentage }: any) =>
  percentage > 5 ? `${segment}` : "";

const RfmChart = React.memo(function RfmChart({
  data,
}: {
  data: RFMDistribution[];
}) {
  if (!data.length) {
    return (
      <div className="text-center py-8 text-sm text-zinc-400">
        Sem dados de segmentação RFM.
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    ...d,
    percentage: total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="segment"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          label={renderLabel}
          labelLine={false}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${Number(value).toLocaleString("pt-BR")} clientes`,
            name,
          ]}
        />
        <Legend
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => (
            <span className="text-xs text-zinc-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

export default RfmChart;
