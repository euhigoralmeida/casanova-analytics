"use client";

import type { IntelligenceInsight } from "@/lib/intelligence/types";
import { InsightCard } from "./insight-card";

interface InsightsGridProps {
  insights: IntelligenceInsight[];
  onFollowAction?: (insightId: string, action: string) => void;
}

export function InsightsGrid({ insights, onFollowAction }: InsightsGridProps) {
  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-sm text-zinc-500">Nenhum insight disponível para este período.</p>
      </div>
    );
  }

  // Sort: danger first, then warning, then success
  const sorted = [...insights].sort((a, b) => {
    const order = { danger: 0, warning: 1, success: 2 };
    return (order[a.severity] ?? 1) - (order[b.severity] ?? 1);
  });

  return (
    <div className="space-y-3">
      {sorted.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onFollowAction={onFollowAction}
        />
      ))}
    </div>
  );
}
