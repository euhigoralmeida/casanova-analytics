"use client";

import { formatBRL, formatPct } from "@/lib/format";
import {
  Users,
  ShoppingCart,
  DollarSign,
  Receipt,
  Repeat,
  TrendingUp,
} from "lucide-react";
import type { CRMAnalytics } from "@/lib/crm-engine";

export function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: "emerald" | "amber" | "red";
}) {
  const borderColor = color === "emerald" ? "border-emerald-300" : color === "amber" ? "border-amber-300" : color === "red" ? "border-red-300" : "border-zinc-200";
  return (
    <div className={`rounded-xl border ${borderColor} bg-white p-4`}>
      <div className="flex items-center gap-2 text-zinc-500 mb-1">
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-zinc-900 truncate">{value}</p>
    </div>
  );
}

export function KpiGrid({ summary }: { summary: CRMAnalytics["summary"] }) {
  const s = summary;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard icon={Users} label="Clientes" value={s.totalCustomers.toLocaleString("pt-BR")} />
      <KpiCard icon={ShoppingCart} label="Pedidos" value={s.totalOrders.toLocaleString("pt-BR")} />
      <KpiCard icon={DollarSign} label="Receita" value={formatBRL(s.totalRevenue)} />
      <KpiCard icon={Receipt} label="Ticket Medio" value={formatBRL(s.avgTicket)} />
      <KpiCard icon={Repeat} label="Recompra" value={formatPct(s.repurchaseRate)} color={s.repurchaseRate >= 30 ? "emerald" : s.repurchaseRate >= 20 ? "amber" : "red"} />
      <KpiCard icon={TrendingUp} label="LTV Medio" value={formatBRL(s.avgLTV)} />
    </div>
  );
}
