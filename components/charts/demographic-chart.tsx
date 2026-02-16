"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DemographicSlice } from "@/lib/intelligence/data-layer/types";
import { formatBRL } from "@/lib/format";

const AGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: "18-24",
  AGE_RANGE_25_34: "25-34",
  AGE_RANGE_35_44: "35-44",
  AGE_RANGE_45_54: "45-54",
  AGE_RANGE_55_64: "55-64",
  AGE_RANGE_65_UP: "65+",
  AGE_RANGE_UNDETERMINED: "N/D",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Feminino",
  UNDETERMINED: "N/D",
};

interface DemographicChartProps {
  data: DemographicSlice[];
  view: "age" | "gender";
}

function roasFill(roas: number): string {
  if (roas >= 7) return "#10b981";
  if (roas >= 5) return "#f59e0b";
  return "#ef4444";
}

export default function DemographicChart({ data, view }: DemographicChartProps) {
  const filtered = data
    .filter((d) => d.type === view && d.segment !== "AGE_RANGE_UNDETERMINED" && d.segment !== "UNDETERMINED")
    .filter((d) => d.costBRL > 0);

  const labels = view === "age" ? AGE_LABELS : GENDER_LABELS;

  const chartData = filtered.map((d) => ({
    name: labels[d.segment] ?? d.segment,
    roas: d.roas,
    receita: Math.round(d.revenue),
    investimento: Math.round(d.costBRL),
    fill: roasFill(d.roas),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "roas") return [value.toFixed(1), "ROAS"];
            return [formatBRL(value), name === "receita" ? "Receita" : "Investimento"];
          }}
        />
        <Bar
          dataKey="roas"
          radius={[0, 4, 4, 0]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill="#3b82f6"
          // Use individual colors from data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shape={(props: any) => {
            const { fill: _fill, ...rest } = props;
            return <rect {...rest} fill={props.payload.fill} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
