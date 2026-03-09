"use client";

import { formatBRL, formatPct } from "@/lib/format";
import { exportToCSV } from "@/lib/export-csv";
import type { RepurchaseBySku } from "@/lib/crm-engine";

export function SkuTable({ data }: { data: RepurchaseBySku[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium">Produto</th>
            <th className="px-3 py-2 font-medium text-right">Compradores</th>
            <th className="px-3 py-2 font-medium text-right">Recompra</th>
            <th className="px-3 py-2 font-medium text-right">Taxa</th>
            <th className="px-3 py-2 font-medium text-right">Qtd Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.sku} className="border-t border-zinc-100">
              <td className="px-3 py-2 font-mono text-zinc-700">{d.sku}</td>
              <td className="px-3 py-2 text-zinc-600 truncate max-w-[200px]">{d.nome}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.totalBuyers.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.repeatBuyers.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right">
                <span className={`font-medium ${d.repurchaseRate >= 30 ? "text-emerald-600" : d.repurchaseRate >= 20 ? "text-amber-600" : "text-zinc-600"}`}>
                  {formatPct(d.repurchaseRate)}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.totalQuantity.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function handleExportSku(data: RepurchaseBySku[]) {
  exportToCSV(
    data,
    [
      { key: "sku", label: "SKU" },
      { key: "nome", label: "Produto" },
      { key: "totalBuyers", label: "Compradores" },
      { key: "repeatBuyers", label: "Recompra" },
      { key: "repurchaseRate", label: "Taxa %" },
      { key: "totalQuantity", label: "Qtd Total" },
    ],
    "recompra-por-sku.csv",
  );
}
