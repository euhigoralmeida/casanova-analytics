"use client";

import type { IntelligenceSummary } from "@/lib/intelligence/types";
import type { ModeAssessment, Bottleneck, PacingProjection } from "@/lib/intelligence/cognitive/types";
import type { ExecutiveSummaryData } from "@/lib/intelligence/communication/types";
import type { TrendData } from "@/lib/intelligence/data-layer/trend-analyzer";
import { AlertTriangle, TrendingUp, Zap, Target, Crosshair } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface ExecutiveSummaryProps {
  summary: IntelligenceSummary;
  // Cognitive engine props (optional for backward compat)
  mode?: ModeAssessment;
  bottleneck?: Bottleneck;
  pacingProjections?: PacingProjection[];
  executiveSummary?: ExecutiveSummaryData;
  accountTrend?: TrendData;
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

const MODE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  ESCALAR: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  OTIMIZAR: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  PROTEGER: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  REESTRUTURAR: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
};

const MODE_LABELS: Record<string, string> = {
  ESCALAR: "Escalar",
  OTIMIZAR: "Otimizar",
  PROTEGER: "Proteger",
  REESTRUTURAR: "Reestruturar",
};

const BOTTLENECK_LABELS: Record<string, string> = {
  traffic: "Tráfego",
  conversion: "Conversão",
  aov: "Ticket Médio",
  margin: "Margem",
  budget: "Orçamento",
};

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

const TREND_DISPLAY: Record<string, { arrow: string; label: string; color: string }> = {
  improving: { arrow: "↑", label: "Em melhoria", color: "text-emerald-600" },
  stable: { arrow: "→", label: "Estável", color: "text-zinc-500" },
  declining: { arrow: "↓", label: "Em queda", color: "text-red-600" },
};

export function ExecutiveSummary({ summary, mode, bottleneck, pacingProjections, executiveSummary, accountTrend }: ExecutiveSummaryProps) {
  const { healthScore, topPriority, quickWins } = summary;
  const hasCognitive = !!mode;
  const modeStyle = mode ? MODE_COLORS[mode.mode] ?? MODE_COLORS.OTIMIZAR : MODE_COLORS.OTIMIZAR;

  return (
    <div className="space-y-4">
      {/* Cognitive header: Mode + Bottleneck + Executive Headline */}
      {hasCognitive && (
        <div className={`rounded-2xl border p-4 ${modeStyle.bg} ${modeStyle.ring} ring-1`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Target className={`h-5 w-5 ${modeStyle.text}`} />
              <span className={`text-sm font-bold ${modeStyle.text}`}>
                Modo: {MODE_LABELS[mode!.mode]}
              </span>
              {accountTrend && (
                <span className={`text-xs font-medium ${TREND_DISPLAY[accountTrend.classification]?.color ?? "text-zinc-500"}`}>
                  {TREND_DISPLAY[accountTrend.classification]?.arrow} {TREND_DISPLAY[accountTrend.classification]?.label}
                </span>
              )}
            </div>
            {bottleneck && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                <Crosshair className="h-3.5 w-3.5" />
                Gargalo: <span className="font-semibold">{BOTTLENECK_LABELS[bottleneck.constraint]}</span>
                {bottleneck.financialImpact.netImpact > 0 && (
                  <span className="text-zinc-400">
                    (+{formatBRL(bottleneck.financialImpact.netImpact)} se destravar)
                  </span>
                )}
              </div>
            )}
          </div>
          {executiveSummary && (
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              {executiveSummary.topAction}
            </p>
          )}
          {/* Pacing projections */}
          {pacingProjections && pacingProjections.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {pacingProjections.map((p) => {
                const scenarioColor = p.scenario === "on_track" ? "text-emerald-600" : p.scenario === "at_risk" ? "text-amber-600" : "text-red-600";
                return (
                  <div key={p.metric} className="bg-white/60 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] text-zinc-500 block">{p.label}</span>
                    <span className={`text-xs font-semibold ${scenarioColor}`}>
                      {p.projectedGapBRL !== 0 ? formatBRL(p.projectedEndOfMonth) : Math.round(p.projectedEndOfMonth).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-zinc-400 ml-1">
                      / {p.projectedGapBRL !== 0 ? formatBRL(p.target) : Math.round(p.target).toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Original 3-column grid */}
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
              {healthScore >= 85 ? "Excelente" : healthScore >= 70 ? "Bom" : healthScore >= 50 ? "Atenção" : healthScore >= 30 ? "Crítico" : "Urgente"}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {hasCognitive ? mode!.description : "Saúde geral da operação"}
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
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">
                {topPriority.description}
              </p>
              {topPriority.financialImpact && topPriority.financialImpact.netImpact > 0 && (
                <p className="text-xs font-semibold text-emerald-600 mt-1.5">
                  Impacto: {formatBRL(topPriority.financialImpact.netImpact)}/mês
                </p>
              )}
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
                  <div>
                    <span className="text-xs text-zinc-700 leading-relaxed">
                      {qw.recommendations[0]?.action ?? qw.title}
                    </span>
                    {qw.financialImpact && qw.financialImpact.netImpact > 0 && (
                      <span className="text-[10px] text-emerald-600 font-semibold ml-1">
                        +{formatBRL(qw.financialImpact.netImpact)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">Nenhuma ação rápida disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}
