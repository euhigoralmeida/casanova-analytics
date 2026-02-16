"use client";

import type { IntelligenceSummary } from "@/lib/intelligence/types";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";

interface ExecutiveSummaryProps {
  summary: IntelligenceSummary;
}

function healthColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function healthRing(score: number): string {
  if (score >= 75) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

function healthBg(score: number): string {
  if (score >= 75) return "from-emerald-50 to-emerald-100/50 border-emerald-200";
  if (score >= 50) return "from-amber-50 to-amber-100/50 border-amber-200";
  return "from-red-50 to-red-100/50 border-red-200";
}

function healthLabel(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Atenção";
  if (score >= 30) return "Crítico";
  return "Urgente";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="88" height="88" className="shrink-0">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="7" />
      <circle
        cx="44" cy="44" r={radius}
        fill="none"
        className={healthRing(score)}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
      <text x="44" y="40" textAnchor="middle" className={`text-xl font-bold ${healthColor(score)}`} fill="currentColor">
        {score}
      </text>
      <text x="44" y="56" textAnchor="middle" className="text-[10px] text-zinc-400" fill="currentColor">
        / 100
      </text>
    </svg>
  );
}

export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  const { healthScore, topPriority, quickWins } = summary;

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
      {/* Health Score */}
      <div className={`rounded-2xl border bg-gradient-to-br p-5 flex items-center gap-4 ${healthBg(healthScore)}`}>
        <ScoreRing score={healthScore} />
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Health Score
          </div>
          <p className={`text-lg font-bold ${healthColor(healthScore)}`}>
            {healthLabel(healthScore)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Saúde geral da operação
          </p>
        </div>
      </div>

      {/* Top Priority */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          Prioridade Principal
        </div>
        {topPriority ? (
          <div>
            <p className={`text-sm font-semibold ${topPriority.severity === "danger" ? "text-red-700" : "text-amber-700"}`}>
              {topPriority.title}
            </p>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed line-clamp-3">
              {topPriority.description}
            </p>
          </div>
        ) : (
          <p className="text-sm text-emerald-600 font-medium">
            Nenhum problema crítico identificado
          </p>
        )}
      </div>

      {/* Quick Wins */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-3">
          <Zap className="h-3.5 w-3.5" />
          Ações Rápidas
        </div>
        {quickWins.length > 0 ? (
          <ul className="space-y-2">
            {quickWins.map((qw) => (
              <li key={qw.id} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs text-zinc-700 leading-relaxed">
                  {qw.recommendations[0]?.action ?? qw.title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">Nenhuma ação rápida disponível</p>
        )}
      </div>
    </div>
  );
}
