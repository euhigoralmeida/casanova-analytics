"use client";

import { useState, useEffect } from "react";
import { BrainCircuit, RefreshCw, AlertTriangle, Lightbulb, ShieldAlert, HelpCircle } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

type Decision = {
  priority: number;
  domain: "aquisicao" | "retencao" | "cro" | "cross";
  action: string;
  reasoning: string;
  estimatedImpact: string;
  effort: "baixo" | "medio" | "alto";
  urgency: "imediata" | "esta_semana" | "este_mes";
  metricsToWatch: string[];
};

type CrossDomainInsight = {
  insight: string;
  domains: string[];
  implication: string;
};

type AvoidAction = {
  action: string;
  reason: string;
};

type AdvisorData = {
  diagnosis: {
    headline: string;
    body: string;
    primaryBottleneck: "aquisicao" | "cro" | "retencao";
  };
  decisions: Decision[];
  crossDomainInsights: CrossDomainInsight[];
  avoidActions: AvoidAction[];
  strategicQuestion: string;
  generatedAt: string;
  cached: boolean;
};

interface StrategicAdvisorCardProps {
  startDate: string;
  endDate: string;
}

const DOMAIN_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  aquisicao: { bg: "bg-blue-100", text: "text-blue-700", label: "Aquisicao" },
  cro: { bg: "bg-amber-100", text: "text-amber-700", label: "CRO" },
  retencao: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Retencao" },
  cross: { bg: "bg-violet-100", text: "text-violet-700", label: "Cross" },
};

const EFFORT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  baixo: { bg: "bg-emerald-50", text: "text-emerald-600", label: "Baixo" },
  medio: { bg: "bg-amber-50", text: "text-amber-600", label: "Medio" },
  alto: { bg: "bg-red-50", text: "text-red-600", label: "Alto" },
};

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  imediata: { bg: "bg-red-50", text: "text-red-600", label: "Imediata" },
  esta_semana: { bg: "bg-amber-50", text: "text-amber-600", label: "Esta semana" },
  este_mes: { bg: "bg-zinc-100", text: "text-zinc-600", label: "Este mes" },
};

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

function DomainBadge({ domain }: { domain: string }) {
  const style = DOMAIN_STYLES[domain] ?? DOMAIN_STYLES.cross;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function StrategicAdvisorCard({ startDate, endDate }: StrategicAdvisorCardProps) {
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAdvisor() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/strategic-advisor?startDate=${startDate}&endDate=${endDate}`,
      );

      if (res.status === 503) {
        setError("disabled");
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao gerar analise estrategica");
        return;
      }

      setData(await res.json());
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchAdvisor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Hide silently when AI disabled
  if (error === "disabled") return null;

  const bottleneckStyle = data
    ? DOMAIN_STYLES[data.diagnosis.primaryBottleneck] ?? DOMAIN_STYLES.cross
    : null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-indigo-50 to-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-violet-800">Consultor Estrategico</h3>
          {data?.cached && (
            <span className="text-[10px] text-zinc-400">(cache)</span>
          )}
        </div>
        <button
          onClick={fetchAdvisor}
          disabled={loading}
          className="text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-50"
          title="Atualizar analise"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-3">
            <div className="h-5 bg-violet-100 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-violet-100 rounded animate-pulse w-full" />
            <div className="h-4 bg-violet-100 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-violet-100 rounded animate-pulse w-4/6" />
          </div>
        )}

        {error && error !== "disabled" && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {data && (
          <>
            {/* Diagnosis */}
            <div>
              <h4 className="text-base font-bold text-zinc-900 mb-1">
                {data.diagnosis.headline}
              </h4>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Gargalo principal:</span>
                {bottleneckStyle && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${bottleneckStyle.bg} ${bottleneckStyle.text}`}>
                    {bottleneckStyle.label}
                  </span>
                )}
              </div>
              <div
                className="text-sm text-zinc-700 leading-relaxed prose prose-sm max-w-none prose-strong:text-violet-800"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(formatMarkdown(data.diagnosis.body)),
                }}
              />
            </div>

            {/* Decisions */}
            {data.decisions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Lightbulb size={13} />
                  Decisoes Priorizadas
                </h4>
                <div className="space-y-3">
                  {data.decisions.map((d, i) => {
                    const effort = EFFORT_STYLES[d.effort] ?? EFFORT_STYLES.medio;
                    const urgency = URGENCY_STYLES[d.urgency] ?? URGENCY_STYLES.este_mes;
                    return (
                      <div key={i} className="bg-white rounded-xl border border-zinc-100 p-3">
                        <div className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                            {d.priority}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <DomainBadge domain={d.domain} />
                              <span className="text-sm font-medium text-zinc-800">{d.action}</span>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed mb-2">{d.reasoning}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                {d.estimatedImpact}
                              </span>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${effort.bg} ${effort.text}`}>
                                Esforco: {effort.label}
                              </span>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${urgency.bg} ${urgency.text}`}>
                                {urgency.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cross-Domain Insights */}
            {data.crossDomainInsights.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Lightbulb size={13} />
                  Conexoes Cross-Domain
                </h4>
                <div className="space-y-2">
                  {data.crossDomainInsights.map((ci, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-violet-500 mt-0.5 shrink-0">&#x2022;</span>
                      <div>
                        <span className="text-zinc-700">{ci.insight}</span>
                        <div className="flex items-center gap-1 mt-1">
                          {ci.domains.map((d) => (
                            <DomainBadge key={d} domain={d} />
                          ))}
                          <span className="text-xs text-zinc-500 ml-1">{ci.implication}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Avoid Actions */}
            {data.avoidActions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ShieldAlert size={13} />
                  Evitar Agora
                </h4>
                <div className="space-y-2">
                  {data.avoidActions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">{a.action}</p>
                        <p className="text-xs text-amber-600 mt-0.5">{a.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Question */}
            {data.strategicQuestion && (
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                <div className="flex items-start gap-2">
                  <HelpCircle size={16} className="text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-violet-800 font-medium italic leading-relaxed">
                    {data.strategicQuestion}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
