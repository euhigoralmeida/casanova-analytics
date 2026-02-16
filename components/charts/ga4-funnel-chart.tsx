"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { GA4DailyPoint } from "@/types/api";

export default function GA4FunnelChart({ data }: { data: GA4DailyPoint[] }) {
  const chartData = data.map((p) => ({
    ...p,
    label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
    revenueK: Math.round(p.purchaseRevenue / 1000 * 100) / 100,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `R$${v}k`}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = Number(value ?? 0);
              if (name === "revenueK") return [`R$ ${(v * 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, "Receita"];
              const labels: Record<string, string> = {
                sessions: "Sessões",
                pageViews: "Page Views",
                viewItems: "View Content",
                addToCarts: "Add to Cart",
                checkouts: "Initiate Checkout",
                shippingInfos: "Shipping Info",
                paymentInfos: "Payment Info",
                purchases: "Purchase",
              };
              return [v.toLocaleString("pt-BR"), labels[name as string] ?? name];
            }}
            labelFormatter={(label: unknown) => `Dia ${label}`}
          />
          <Legend formatter={(value: unknown) => {
            const labels: Record<string, string> = {
              sessions: "Sessões",
              pageViews: "Page Views",
              viewItems: "View Content",
              addToCarts: "Add to Cart",
              checkouts: "Checkout",
              shippingInfos: "Shipping",
              paymentInfos: "Payment",
              purchases: "Purchase",
              revenueK: "Receita (R$k)",
            };
            return labels[value as string] ?? value;
          }} />
          <Area type="monotone" dataKey="sessions" fill="#e0e7ff" stroke="#818cf8" strokeWidth={1.5} fillOpacity={0.3} yAxisId="left" />
          <Line type="monotone" dataKey="pageViews" stroke="#3b82f6" strokeWidth={1.5} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="viewItems" stroke="#6366f1" strokeWidth={1.5} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="addToCarts" stroke="#a855f7" strokeWidth={2} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="checkouts" stroke="#f59e0b" strokeWidth={2} dot={false} yAxisId="left" />
          <Bar dataKey="purchases" fill="#10b981" radius={[2, 2, 0, 0]} yAxisId="left" />
          <Line type="monotone" dataKey="revenueK" stroke="#ef4444" strokeWidth={2} dot={false} yAxisId="right" strokeDasharray="5 5" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
