"use client";

import type { IntelligenceInsight } from "@/lib/intelligence/types";
import { TrendingDown, TrendingUp, AlertTriangle, Lightbulb, BarChart3, ChevronRight, DollarSign } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface InsightCardProps {
  insight: IntelligenceInsight;
  onFollowAction?: (insightId: string, action: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  planning_gap: "Planejamento",
  efficiency: "Eficiência",
  opportunity: "Oportunidade",
  risk: "Risco",
  composition: "Composição",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  planning_gap: <BarChart3 className="h-4 w-4" />,
  efficiency: <TrendingDown className="h-4 w-4" />,
  opportunity: <Lightbulb className="h-4 w-4" />,
  risk: <AlertTriangle className="h-4 w-4" />,
  composition: <TrendingUp className="h-4 w-4" />,
};

const SEVERITY_STYLES: Record<string, { border: string; icon: string; badge: string }> = {
  danger: {
    border: "border-l-red-500 bg-red-50/40",
    icon: "bg-red-100 text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    border: "border-l-amber-500 bg-amber-50/30",
    icon: "bg-amber-100 text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  success: {
    border: "border-l-emerald-500 bg-emerald-50/30",
    icon: "bg-emerald-100 text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

export function InsightCard({ insight, onFollowAction }: InsightCardProps) {
  const { category, severity, title, description, recommendations, financialImpact } = insight;
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.warning;
  const hasImpact = financialImpact && financialImpact.netImpact > 0;

  return (
    <div className={`rounded-xl border border-l-4 p-4 transition-shadow hover:shadow-sm ${styles.border}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`rounded-lg p-2 shrink-0 ${styles.icon}`}>
          {CATEGORY_ICONS[category]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              {CATEGORY_LABELS[category] ?? category}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
              {severity === "danger" ? "Crítico" : severity === "warning" ? "Atenção" : "Positivo"}
            </span>
            {/* Financial impact badge */}
            {hasImpact && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                <DollarSign className="h-2.5 w-2.5" />
                {financialImpact.netImpact >= 1000
                  ? `+${(financialImpact.netImpact / 1000).toFixed(1).replace(".", ",")}k`
                  : `+${formatBRL(financialImpact.netImpact)}`
                }
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
          <p className="text-xs text-zinc-500 leading-relaxed mt-1">{description}</p>

          {/* Root cause (from correlation engine) */}
          {insight.rootCause && (
            <p className="text-[10px] text-indigo-600 mt-1 italic">
              Causa raiz: {insight.rootCause}
            </p>
          )}

          {/* Financial impact detail */}
          {hasImpact && financialImpact.calculation && (
            <p className="text-[10px] text-zinc-400 mt-1 italic">
              {financialImpact.calculation}
            </p>
          )}

          {/* First recommendation inline */}
          {recommendations.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {onFollowAction ? (
                <button
                  onClick={() => onFollowAction(insight.id, recommendations[0].action)}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 transition-colors"
                >
                  {recommendations[0].action.length > 50
                    ? recommendations[0].action.slice(0, 47) + "..."
                    : recommendations[0].action}
                  <ChevronRight className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-xs text-zinc-500 italic">
                  {recommendations[0].action}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
