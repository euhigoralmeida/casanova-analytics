"use client";

import { formatBRL, formatPct } from "@/lib/format";
import type { DiscountImpact } from "@/lib/crm-engine";

export function DiscountSection({ data }: { data: DiscountImpact }) {
  const totalOrders = data.withDiscount.orders + data.withoutDiscount.orders;
  const discountPct = totalOrders > 0 ? Math.round((data.withDiscount.orders / totalOrders) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Pedidos c/ desconto</p>
          <p className="text-sm font-bold text-zinc-700">{formatPct(discountPct)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Ticket c/ desconto</p>
          <p className="text-sm font-bold text-zinc-700">{formatBRL(data.withDiscount.avgTicket)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Ticket s/ desconto</p>
          <p className="text-sm font-bold text-zinc-700">{formatBRL(data.withoutDiscount.avgTicket)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-600">Lift na recompra</p>
          <p className="text-sm font-bold text-emerald-700">+{formatPct(data.discountLift)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs font-medium text-zinc-500 mb-2">Com Desconto</p>
          <div className="flex justify-between text-xs text-zinc-600">
            <span>Pedidos: {data.withDiscount.orders.toLocaleString("pt-BR")}</span>
            <span>Recompra: <span className="font-semibold">{formatPct(data.withDiscount.repurchaseRate)}</span></span>
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Receita: {formatBRL(data.withDiscount.revenue)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="text-xs font-medium text-zinc-500 mb-2">Sem Desconto</p>
          <div className="flex justify-between text-xs text-zinc-600">
            <span>Pedidos: {data.withoutDiscount.orders.toLocaleString("pt-BR")}</span>
            <span>Recompra: <span className="font-semibold">{formatPct(data.withoutDiscount.repurchaseRate)}</span></span>
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Receita: {formatBRL(data.withoutDiscount.revenue)}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Descontos aumentam a taxa de recompra em <span className="font-semibold text-emerald-600">{formatPct(data.discountLift)}</span>
      </p>
    </div>
  );
}
