"use client";

import type { ProductAffinityPair } from "@/lib/crm-engine";

export function AffinityTable({ data }: { data: ProductAffinityPair[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">Produto A</th>
            <th className="px-3 py-2 font-medium">Produto B</th>
            <th className="px-3 py-2 font-medium text-right">Compras Juntas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-zinc-700">
                <span className="font-mono text-zinc-400 mr-1">{d.skuA}</span>
                <span className="text-zinc-600">{d.nomeA}</span>
              </td>
              <td className="px-3 py-2 text-zinc-700">
                <span className="font-mono text-zinc-400 mr-1">{d.skuB}</span>
                <span className="text-zinc-600">{d.nomeB}</span>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-zinc-700">{d.coOccurrences}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
