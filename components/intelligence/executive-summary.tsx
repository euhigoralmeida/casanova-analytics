"use client";

import type { IntelligenceSummary } from "@/lib/intelligence/types";
import type { ModeAssessment, Bottleneck, PacingProjection } from "@/lib/intelligence/cognitive/types";
import type { ExecutiveSummaryData } from "@/lib/intelligence/communication/types";
import type { TrendData } from "@/lib/intelligence/data-layer/trend-analyzer";
import { AlertTriangle, TrendingUp, Target, Crosshair } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface ExecutiveSummaryProps {
  summary: IntelligenceSummary;
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

const MODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ESCALAR: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  OTIMIZAR: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  PROTEGER: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  REESTRUTURAR: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
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

const TREND_DISPLAY: Record<string, { arrow: string; label: string; color: string }> = {
  improving: { arrow: "↑", label: "Em melhoria", color: "text-emerald-600" },
  stable: { arrow: "→", label: "Estável", color: "text-zinc-500" },
  declining: { arrow: "↓", label: "Em queda", color: "text-red-600" },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={radius}
        fill="none"
        className={healthRing(score)}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
      <text x="36" y="33" textAnchor="middle" className={`text-lg font-bold ${healthColor(score)}`} fill="currentColor">
        {score}
      </text>
      <text x="36" y="47" textAnchor="middle" className="text-[9px] text-zinc-400" fill="currentColor">
        / 100
      </text>
    </svg>
  );
}

export function ExecutiveSummary({ summary, mode, bottleneck, pacingProjections, executiveSummary, accountTrend }: ExecutiveSummaryProps) {
  const { healthScore, topPriority } = summary;
  const hasCognitive = !!mode;
  const modeStyle = mode ? MODE_COLORS[mode.mode] ?? MODE_COLORS.OTIMIZAR : null;

  return (
    <div className={`rounded-2xl border overflow-hidden ${modeStyle ? modeStyle.border : "border-zinc-200"}`}>
      {/* Top strip: Mode + Trend + Bottleneck */}
      {hasCognitive && modeStyle && (
        <div className={`px-5 py-2.5 ${modeStyle.bg} flex flex-wrap items-center gap-x-4 gap-y-1`}>
          <div className="flex items-center gap-1.5">
            <Target className={`h-4 w-4 ${modeStyle.text}`} />
            <span className={`text-sm font-bold ${modeStyle.text}`}>
              Modo: {MODE_LABELS[mode!.mode]}
            </span>
          </div>
          {accountTrend && TREND_DISPLAY[accountTrend.classification] && (
            <span className={`text-xs font-medium ${TREND_DISPLAY[accountTrend.classification].color}`}>
              {TREND_DISPLAY[accountTrend.classification].arrow} {TREND_DISPLAY[accountTrend.classification].label}
            </span>
          )}
          {bottleneck && (
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <Crosshair className="h-3.5 w-3.5" />
              Gargalo: <span className="font-semibold">{BOTTLENECK_LABELS[bottleneck.constraint]}</span>
              {bottleneck.financialImpact.netImpact > 0 && (
                <span className="text-zinc-400 ml-0.5">
                  (+{formatBRL(bottleneck.financialImpact.netImpact)} se destravar)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main body: 3 columns */}
      <div className="grid gap-4 p-5 md:grid-cols-[auto_1fr_1fr] bg-white">
        {/* Score */}
        <div className="flex items-center gap-3">
          <ScoreRing score={healthScore} />
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              <TrendingUp className="h-3 w-3" />
              Health Score
            </div>
            <p className={`text-base font-bold ${healthColor(healthScore)}`}>
              {healthScore >= 85 ? "Excelente" : healthScore >= 70 ? "Bom" : healthScore >= 50 ? "Atenção" : healthScore >= 30 ? "Crítico" : "Urgente"}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5 max-w-[180px]">
              {hasCognitive ? mode!.description : "Saúde geral da operação"}
            </p>
          </div>
        </div>

        {/* Top Action / Executive Summary */}
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
            {hasCognitive ? `Ação Principal — ${MODE_LABELS[mode!.mode]}` : "Modo Estratégico"}
          </span>
          {executiveSummary ? (
            <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3">
              {executiveSummary.topAction}
            </p>
          ) : hasCognitive ? (
            <p className="text-sm text-zinc-700">{mode!.description}</p>
          ) : (
            <p className="text-sm text-zinc-400">Análise cognitiva indisponível</p>
          )}
        </div>

        {/* Top Priority */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
            <AlertTriangle className="h-3 w-3" />
            Prioridade Principal
          </div>
          {topPriority ? (
            <div>
              <p className={`text-sm font-semibold ${topPriority.severity === "danger" ? "text-red-700" : "text-amber-700"}`}>
                {topPriority.title}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                {topPriority.description}
              </p>
              {topPriority.financialImpact && topPriority.financialImpact.netImpact > 0 && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">
                  Impacto: {formatBRL(topPriority.financialImpact.netImpact)}/mês
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-emerald-600 font-medium">Nenhum problema crítico</p>
          )}
        </div>
      </div>

      {/* Bottom strip: Pacing */}
      {pacingProjections && pacingProjections.length > 0 && (
        <div className="px-5 py-2.5 bg-zinc-50 border-t border-zinc-100 flex flex-wrap gap-x-6 gap-y-1">
          {pacingProjections.map((p) => {
            const scenarioColor = p.scenario === "on_track" ? "text-emerald-600" : p.scenario === "at_risk" ? "text-amber-600" : "text-red-600";
            const formatted = p.projectedGapBRL !== 0 ? formatBRL(p.projectedEndOfMonth) : Math.round(p.projectedEndOfMonth).toLocaleString("pt-BR");
            const targetFormatted = p.projectedGapBRL !== 0 ? formatBRL(p.target) : Math.round(p.target).toLocaleString("pt-BR");
            return (
              <div key={p.metric} className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400">{p.label}:</span>
                <span className={`text-xs font-semibold ${scenarioColor}`}>{formatted}</span>
                <span className="text-[10px] text-zinc-400">/ {targetFormatted}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
