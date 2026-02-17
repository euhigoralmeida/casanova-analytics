"use client";

import { useState } from "react";
import type { IntelligenceInsight, Recommendation } from "@/lib/intelligence/types";
import { Check, X } from "lucide-react";

interface RecommendationsPanelProps {
  insights: IntelligenceInsight[];
  quickWins?: IntelligenceInsight[];
  onFollow?: (insightId: string, action: string) => void;
  onDismiss?: (insightId: string, action: string) => void;
}

type FlatRec = {
  insightId: string;
  severity: string;
  rec: Recommendation;
};

const IMPACT_BADGE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-zinc-100 text-zinc-600",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Rápido",
  medium: "Moderado",
  high: "Complexo",
};

export function RecommendationsPanel({ insights, quickWins, onFollow, onDismiss }: RecommendationsPanelProps) {
  const [actioned, setActioned] = useState<Map<number, "followed" | "dismissed">>(new Map());

  const allRecs: FlatRec[] = [];
  const seenActions = new Set<string>();

  // Merge quickWins first (they are quick / high priority)
  if (quickWins) {
    for (const qw of quickWins) {
      for (const rec of qw.recommendations) {
        const key = rec.action.toLowerCase().trim();
        if (!seenActions.has(key)) {
          seenActions.add(key);
          allRecs.push({ insightId: qw.id, severity: qw.severity, rec });
        }
      }
    }
  }

  // Then insight recommendations
  for (const insight of insights) {
    for (const rec of insight.recommendations) {
      const key = rec.action.toLowerCase().trim();
      if (!seenActions.has(key)) {
        seenActions.add(key);
        allRecs.push({ insightId: insight.id, severity: insight.severity, rec });
      }
    }
  }

  // Sort: high impact + low effort first
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const effortOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  allRecs.sort((a, b) => {
    const aScore = (impactOrder[a.rec.impact] ?? 1) + (effortOrder[a.rec.effort] ?? 1);
    const bScore = (impactOrder[b.rec.impact] ?? 1) + (effortOrder[b.rec.effort] ?? 1);
    return aScore - bScore;
  });

  const topRecs = allRecs.slice(0, 5);
  if (topRecs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-800">
          Recomendações Prioritárias
        </h3>
      </div>
      <div className="divide-y divide-zinc-50">
        {topRecs.map((item, i) => {
          const status = actioned.get(i);
          const isDismissed = status === "dismissed";
          const isFollowed = status === "followed";

          return (
            <div
              key={i}
              className={`flex items-start gap-3 px-5 py-3 transition-all ${isDismissed ? "opacity-30" : "hover:bg-zinc-50/50"}`}
            >
              <span className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm text-zinc-800 leading-snug ${isDismissed ? "line-through" : ""}`}>
                  {item.rec.action}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IMPACT_BADGE[item.rec.impact] ?? ""}`}>
                    {IMPACT_LABEL[item.rec.impact]}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {EFFORT_LABEL[item.rec.effort]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {status ? (
                  isFollowed ? (
                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                      ✓ Seguindo
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-zinc-400">
                      Descartado
                    </span>
                  )
                ) : (
                  <>
                    {onFollow && (
                      <button
                        onClick={() => {
                          setActioned(prev => new Map(prev).set(i, "followed"));
                          onFollow(item.insightId, item.rec.action);
                        }}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Seguir recomendação"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => {
                          setActioned(prev => new Map(prev).set(i, "dismissed"));
                          onDismiss(item.insightId, item.rec.action);
                        }}
                        className="rounded-lg p-1.5 text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-colors"
                        title="Descartar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
