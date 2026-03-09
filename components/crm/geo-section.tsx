"use client";

import { formatBRL, formatPct } from "@/lib/format";
import type { GeoRow } from "@/lib/crm-engine";

export function GeoTable({ data }: { data: GeoRow[] }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">UF</th>
            <th className="px-3 py-2 font-medium text-right">Pedidos</th>
            <th className="px-3 py-2 font-medium text-right">Clientes</th>
            <th className="px-3 py-2 font-medium text-right">Receita</th>
            <th className="px-3 py-2 font-medium text-right">Ticket</th>
            <th className="px-3 py-2 font-medium text-right">Recompra</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((d) => (
            <tr key={d.uf} className="border-t border-zinc-100">
              <td className="px-3 py-2 font-semibold text-zinc-700">{d.uf}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.orders.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.customers.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{formatBRL(d.avgTicket)}</td>
              <td className="px-3 py-2 text-right">
                <span className={`font-medium ${d.repurchaseRate >= 30 ? "text-emerald-600" : d.repurchaseRate >= 20 ? "text-amber-600" : "text-zinc-600"}`}>
                  {formatPct(d.repurchaseRate)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
