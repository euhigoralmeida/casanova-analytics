"use client";

import type { BudgetPlan } from "@/lib/intelligence/strategy/budget-optimizer";
import { formatBRL } from "@/lib/format";
import { ArrowDown, ArrowUp, Wallet, TrendingUp } from "lucide-react";

interface BudgetPlanCardProps {
  plan: BudgetPlan;
}

export function BudgetPlanCard({ plan }: BudgetPlanCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-800">Otimização de Budget</h3>
        </div>
        {plan.improvementBRL > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <TrendingUp className="h-3.5 w-3.5" />
            +{formatBRL(plan.improvementBRL)} estimado
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-px bg-zinc-100">
        <div className="bg-white px-4 py-3 text-center">
          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Budget Total</p>
          <p className="text-sm font-bold text-zinc-900 mt-0.5">{formatBRL(plan.totalBudget)}</p>
        </div>
        <div className="bg-white px-4 py-3 text-center">
          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">ROAS Atual</p>
          <p className="text-sm font-bold text-zinc-900 mt-0.5">{plan.currentTotalRoas.toFixed(1)}x</p>
        </div>
        <div className="bg-white px-4 py-3 text-center">
          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">ROAS Projetado</p>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">{plan.expectedTotalRoas.toFixed(1)}x</p>
        </div>
      </div>

      {/* Allocation Table */}
      {plan.allocations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                <th className="px-5 py-2.5 font-medium">SKU</th>
                <th className="px-3 py-2.5 font-medium text-right">Atual</th>
                <th className="px-3 py-2.5 font-medium text-right">Recomendado</th>
                <th className="px-3 py-2.5 font-medium text-right">Variação</th>
                <th className="px-3 py-2.5 font-medium">Racional</th>
              </tr>
            </thead>
            <tbody>
              {plan.allocations.map((a) => (
                <tr key={a.entity} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                  <td className="px-5 py-2">
                    <p className="text-xs font-medium text-zinc-900">{a.entityName}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">{a.entity}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-zinc-600 tabular-nums">
                    {formatBRL(a.currentBudget)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-zinc-900 tabular-nums">
                    {formatBRL(a.recommendedBudget)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${a.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {a.delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {a.delta > 0 ? "+" : ""}{formatBRL(a.delta)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500 max-w-[200px] truncate">
                    {a.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confidence note */}
      <div className="px-5 py-2.5 bg-zinc-50 border-t border-zinc-100">
        <p className="text-[10px] text-zinc-400">
          Confiança: {(plan.confidence * 100).toFixed(0)}% — Estimativas consideram retorno decrescente de 30% na escala.
        </p>
      </div>
    </div>
  );
}
