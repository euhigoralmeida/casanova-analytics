"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange, CRODataResponse, ClarityPageAnalysis } from "@/types/api";
import type { ClarityChannelBreakdown, ClarityCampaignBreakdown, ClarityTechBreakdown } from "@/types/api";
import { defaultRange } from "@/lib/constants";
import { formatBRL, fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import GA4FunnelChart from "@/components/charts/ga4-funnel-chart";
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Megaphone,
  Cpu,
} from "lucide-react";

/* =========================
   CRO Recommendations Engine (rule-based, with cross-data)
========================= */

type CRORecommendation = {
  severity: "danger" | "warn" | "info";
  title: string;
  description: string;
};

function generateCRORecommendations(data: CRODataResponse): CRORecommendation[] {
  const recs: CRORecommendation[] = [];
  const clarity = data.clarity;
  const summary = data.summary;

  // GA4-based recommendations
  if (summary) {
    if (summary.cartAbandonmentRate > 70) {
      recs.push({
        severity: "danger",
        title: "Abandono de carrinho elevado",
        description: `${summary.cartAbandonmentRate.toFixed(1)}% dos usuarios abandonam o carrinho. Otimizar fluxo de checkout: simplificar etapas, mostrar custos antecipadamente, oferecer multiplos meios de pagamento.`,
      });
    } else if (summary.cartAbandonmentRate > 50) {
      recs.push({
        severity: "warn",
        title: "Abandono de carrinho acima da media",
        description: `${summary.cartAbandonmentRate.toFixed(1)}% de abandono no carrinho. Considerar retargeting e e-mails de recuperacao.`,
      });
    }

    if (summary.checkoutAbandonmentRate > 30) {
      recs.push({
        severity: "warn",
        title: "Abandono no checkout",
        description: `${summary.checkoutAbandonmentRate.toFixed(1)}% abandonam durante o checkout. Verificar formularios, tempo de carregamento e opcoes de frete.`,
      });
    }

    if (summary.bounceRate > 60) {
      recs.push({
        severity: "warn",
        title: "Taxa de rejeicao alta",
        description: `${summary.bounceRate.toFixed(1)}% de bounce rate. Melhorar relevancia das landing pages e velocidade de carregamento.`,
      });
    }
  }

  // Clarity-based recommendations
  if (clarity && clarity.source === "clarity") {
    const b = clarity.behavioral;

    if (b.rageClicks > 100) {
      recs.push({
        severity: "danger",
        title: "Rage clicks excessivos",
        description: `${b.rageClicks.toLocaleString("pt-BR")} rage clicks detectados. Usuarios clicam repetidamente em elementos que nao respondem. Investigar botoes e links quebrados.`,
      });
    } else if (b.rageClicks > 20) {
      recs.push({
        severity: "warn",
        title: "Rage clicks detectados",
        description: `${b.rageClicks.toLocaleString("pt-BR")} rage clicks. Verificar elementos interativos que podem nao estar funcionando corretamente.`,
      });
    }

    if (b.quickbackClicks > 100) {
      recs.push({
        severity: "danger",
        title: "Quickbacks elevados",
        description: `${b.quickbackClicks.toLocaleString("pt-BR")} quickbacks — usuarios saindo rapidamente. Verificar tempo de carregamento e relevancia do conteudo.`,
      });
    } else if (b.quickbackClicks > 30) {
      recs.push({
        severity: "warn",
        title: "Quickbacks acima do esperado",
        description: `${b.quickbackClicks.toLocaleString("pt-BR")} quickbacks detectados. Paginas podem estar com carregamento lento ou conteudo irrelevante.`,
      });
    }

    if (b.avgScrollDepth < 40) {
      recs.push({
        severity: "warn",
        title: "Scroll depth baixo",
        description: `Media de ${b.avgScrollDepth.toFixed(0)}% de scroll. Conteudo abaixo da dobra nao esta sendo visto. Mover CTAs e informacoes importantes para o topo.`,
      });
    }

    if (b.scriptErrors > 10) {
      recs.push({
        severity: "danger",
        title: "Erros JavaScript frequentes",
        description: `${b.scriptErrors.toLocaleString("pt-BR")} erros JS detectados em ${clarity.numDaysCovered} dias. Podem estar impedindo funcionalidades criticas.`,
      });
    } else if (b.scriptErrors > 0) {
      recs.push({
        severity: "info",
        title: "Erros JavaScript detectados",
        description: `${b.scriptErrors} erros JS. Monitorar para evitar impacto na experiencia.`,
      });
    }

    // Bot traffic warning
    if (b.botSessions > 0 && b.totalTraffic > 0) {
      const botPct = Math.round((b.botSessions / b.totalTraffic) * 100);
      if (botPct > 5) {
        recs.push({
          severity: "warn",
          title: "Trafego de bots significativo",
          description: `${botPct}% das sessoes sao de bots (${b.botSessions.toLocaleString("pt-BR")} sessoes). Isso pode distorcer metricas de UX e conversao.`,
        });
      }
    }

    // Page-specific: top offenders
    const worstPages = clarity.pageAnalysis.filter(p => p.uxScore < 40).slice(0, 3);
    for (const page of worstPages) {
      if (page.rageClicks > 50 || page.rageClickRate > 5) {
        recs.push({
          severity: "warn",
          title: `Problemas de UX em "${page.pageTitle}"`,
          description: `${page.rageClickRate}% de rage clicks e ${page.deadClickRate}% de dead clicks por sessao. UX Score: ${page.uxScore}/100, Impact Score: ${page.impactScore}. Investigar elementos interativos.`,
        });
      }
    }

    // Device comparison
    const mobile = clarity.deviceBreakdown.find(d => d.device === "Mobile");
    const desktop = clarity.deviceBreakdown.find(d => d.device === "Desktop");
    if (mobile && desktop) {
      const totalTraffic = clarity.deviceBreakdown.reduce((s, d) => s + d.traffic, 0);
      const mobilePct = totalTraffic > 0 ? Math.round((mobile.traffic / totalTraffic) * 100) : 0;
      const totalProblems = clarity.deviceBreakdown.reduce((s, d) => s + d.rageClicks + d.deadClicks + d.scriptErrors, 0);
      const mobileProblemPct = totalProblems > 0 ? Math.round(((mobile.rageClicks + mobile.deadClicks + mobile.scriptErrors) / totalProblems) * 100) : 0;

      if (mobileProblemPct > mobilePct + 10 && mobile.rageClicks > 30) {
        recs.push({
          severity: "warn",
          title: "UX mobile precisa de atencao prioritaria",
          description: `Mobile tem ${mobilePct}% do trafego mas ${mobileProblemPct}% dos problemas de UX. ${mobile.rageClicks} rage clicks, ${mobile.scriptErrors} erros JS.`,
        });
      }
    }

    // Cross-data: Channel with high frustration
    if (clarity.channelBreakdown.length > 0) {
      const avgRageRate = clarity.channelBreakdown.reduce((s, c) => s + c.rageClickRate, 0) / clarity.channelBreakdown.length;
      for (const ch of clarity.channelBreakdown) {
        if (ch.rageClickRate > avgRageRate * 3 && ch.traffic > 100) {
          recs.push({
            severity: "warn",
            title: `Canal "${ch.channel}" com alta frustracao`,
            description: `${ch.rageClickRate}% de rage clicks (media: ${avgRageRate.toFixed(1)}%). Verificar landing pages e experiencia deste canal.`,
          });
        }
      }
    }

    // Cross-data: Campaign with bad UX
    if (clarity.campaignBreakdown.length > 0) {
      const avgDeadRate = clarity.campaignBreakdown.reduce((s, c) => s + c.deadClickRate, 0) / clarity.campaignBreakdown.length;
      for (const camp of clarity.campaignBreakdown) {
        if (camp.deadClickRate > 15 && camp.deadClickRate > avgDeadRate * 1.5 && camp.traffic > 100) {
          recs.push({
            severity: "warn",
            title: `Campanha "${camp.campaign}" com UX ruim`,
            description: `${camp.deadClickRate}% de dead clicks e ${camp.rageClickRate}% de rage clicks. Investigar landing page antes de aumentar budget.`,
          });
        }
      }
    }

    // Cross-data: OS/Browser with high error rate
    const osTech = clarity.techBreakdown.filter(t => t.type === "os");
    const totalErrors = osTech.reduce((s, t) => s + t.scriptErrors, 0);
    for (const tech of clarity.techBreakdown) {
      if (totalErrors > 0 && tech.scriptErrors > 0) {
        const errPct = Math.round((tech.scriptErrors / totalErrors) * 100);
        if (errPct > 40 && tech.scriptErrors > 50) {
          recs.push({
            severity: "danger",
            title: `${tech.type === "os" ? "SO" : "Navegador"} ${tech.name} concentra erros JS`,
            description: `${tech.name} concentra ${errPct}% dos erros JS (${tech.scriptErrors.toLocaleString("pt-BR")} erros, taxa ${tech.scriptErrorRate}%). Priorizar correcao.`,
          });
          break; // Only show worst offender
        }
      }
    }
  }

  // Sort: danger first, then warn, then info
  const order = { danger: 0, warn: 1, info: 2 };
  recs.sort((a, b) => order[a.severity] - order[b.severity]);

  return recs;
}

/* =========================
   Status color helpers
========================= */

function deadClickStatus(v: number): "ok" | "warn" | "danger" {
  if (v > 200) return "danger";
  if (v >= 50) return "warn";
  return "ok";
}

function rageClickStatus(v: number): "ok" | "warn" | "danger" {
  if (v > 100) return "danger";
  if (v >= 20) return "warn";
  return "ok";
}

function scrollDepthStatus(v: number): "ok" | "warn" | "danger" {
  if (v < 40) return "danger";
  if (v <= 60) return "warn";
  return "ok";
}

function quickbackStatus(v: number): "ok" | "warn" | "danger" {
  if (v > 100) return "danger";
  if (v >= 30) return "warn";
  return "ok";
}

function scriptErrorStatus(v: number): "ok" | "warn" | "danger" {
  if (v > 10) return "danger";
  if (v >= 1) return "warn";
  return "ok";
}

function uxScoreStatus(v: number): "ok" | "warn" | "danger" {
  if (v < 40) return "danger";
  if (v <= 70) return "warn";
  return "ok";
}

function rateStatus(v: number): "ok" | "warn" | "danger" {
  if (v > 15) return "danger";
  if (v >= 5) return "warn";
  return "ok";
}

const statusColors = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  warn: "text-amber-700 bg-amber-50 border-amber-200",
  danger: "text-red-700 bg-red-50 border-red-200",
};

const statusBorder = {
  ok: "border-emerald-300",
  warn: "border-amber-300",
  danger: "border-red-300",
};

function formatEngagementTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* =========================
   Severity badge for recommendations
========================= */

const severityConfig = {
  danger: { bg: "bg-red-100", text: "text-red-800", label: "Critico" },
  warn: { bg: "bg-amber-100", text: "text-amber-800", label: "Atencao" },
  info: { bg: "bg-blue-100", text: "text-blue-800", label: "Info" },
};

/* =========================
   Device icon helper
========================= */

function DeviceIcon({ device }: { device: string }) {
  if (device === "Mobile") return <Smartphone className="h-5 w-5" />;
  if (device === "Tablet") return <Tablet className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

/* =========================
   CRO Page Component
========================= */

export default function CROPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<CRODataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllPages, setShowAllPages] = useState(false);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cro?startDate=${range.startDate}&endDate=${range.endDate}`);
      if (!res.ok) throw new Error("Erro ao carregar dados CRO");
      setData(await res.json());
    } catch {
      setError("Erro ao carregar dados. Tente novamente ou aguarde alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    loadData(range);
  }

  const funnel = data?.funnel;
  const summary = data?.summary;
  const convRate = data?.overallConversionRate ?? 0;
  const channels = data?.channelAcquisition;
  const dailySeries = data?.dailySeries;
  const clarity = data?.clarity;
  const hasClarityData = clarity && clarity.source === "clarity";
  const hasGA4Data = data?.source === "full" || data?.source === "ga4_only";
  const recommendations = data ? generateCRORecommendations(data) : [];

  // Detect bottleneck (step with highest dropoff)
  const bottleneckIdx = funnel ? funnel.reduce((maxI, step, i, arr) =>
    i > 0 && step.dropoff > (arr[maxI]?.dropoff ?? 0) ? i : maxI, 1) : -1;

  // Pages sorted by impact score (already sorted from API)
  const pageAnalysis = clarity?.pageAnalysis ?? [];
  const visiblePages: ClarityPageAnalysis[] = showAllPages ? pageAnalysis : pageAnalysis.slice(0, 10);

  // Channel breakdown
  const channelBreakdown: ClarityChannelBreakdown[] = clarity?.channelBreakdown ?? [];

  // Campaign breakdown
  const campaignBreakdown: ClarityCampaignBreakdown[] = clarity?.campaignBreakdown ?? [];

  // Tech breakdown
  const techBreakdown: ClarityTechBreakdown[] = clarity?.techBreakdown ?? [];
  const osTech = techBreakdown.filter(t => t.type === "os");
  const browserTech = techBreakdown.filter(t => t.type === "browser");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* --- TOP BAR --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900">CRO & Funil</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {data?.source === "full" && <span className="ml-2 text-zinc-400">GA4 + Clarity</span>}
            {data?.source === "ga4_only" && <span className="ml-2 text-zinc-400">GA4</span>}
            {data?.source === "clarity_only" && <span className="ml-2 text-zinc-400">Clarity</span>}
            {loading && <span className="ml-2 text-zinc-400">Atualizando...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(dateRange)}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-700 disabled:opacity-30 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
        </div>
      </div>

      {/* --- ERRO --- */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0">Tentar novamente</button>
        </div>
      )}

      {/* --- LOADING SKELETON --- */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
          <ChartSkeleton />
          <TableSkeleton rows={6} />
        </div>
      )}

      {/* --- NOT CONFIGURED --- */}
      {data?.source === "not_configured" && !funnel && (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-lg font-semibold text-zinc-700 mb-2">GA4 e Clarity nao configurados</p>
          <p className="text-sm text-zinc-500">Configure as credenciais GA4 e/ou Clarity no .env.local para ver dados reais.</p>
        </div>
      )}

      {/* --- KPIs GA4 --- */}
      {summary && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Metricas GA4</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Sessoes</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.sessions.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Usuarios</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.users.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{summary.newUsers.toLocaleString("pt-BR")} novos</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Compras</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{summary.purchases.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Ticket: {formatBRL(summary.avgOrderValue)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Receita GA4</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{formatBRL(summary.purchaseRevenue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* --- KPIs CLARITY (enriched with rates) --- */}
      {clarity && clarity.behavioral && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Comportamento (Clarity)</h2>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Dados de exemplo</span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Dead Clicks */}
            <div className={`rounded-xl border bg-white p-4 ${statusBorder[deadClickStatus(clarity.behavioral.deadClicks)]}`}>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Dead Clicks</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{clarity.behavioral.deadClicks.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Cliques sem resposta</p>
            </div>
            {/* Rage Clicks */}
            <div className={`rounded-xl border bg-white p-4 ${statusBorder[rageClickStatus(clarity.behavioral.rageClicks)]}`}>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Rage Clicks</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{clarity.behavioral.rageClicks.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Cliques de frustracao</p>
            </div>
            {/* Scroll Depth */}
            <div className={`rounded-xl border bg-white p-4 ${statusBorder[scrollDepthStatus(clarity.behavioral.avgScrollDepth)]}`}>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Scroll Depth</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{clarity.behavioral.avgScrollDepth.toFixed(0)}%</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Profundidade media de rolagem</p>
            </div>
            {/* Engagement Time */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Tempo Engajamento</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{formatEngagementTime(clarity.behavioral.avgEngagementTime)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{clarity.behavioral.totalTraffic.toLocaleString("pt-BR")} sessoes</p>
            </div>
            {/* Quickbacks */}
            <div className={`rounded-xl border bg-white p-4 ${statusBorder[quickbackStatus(clarity.behavioral.quickbackClicks)]}`}>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Quickbacks</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{clarity.behavioral.quickbackClicks.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Saidas rapidas</p>
            </div>
            {/* Script Errors */}
            <div className={`rounded-xl border bg-white p-4 ${statusBorder[scriptErrorStatus(clarity.behavioral.scriptErrors)]}`}>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Erros JS</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{clarity.behavioral.scriptErrors.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">em {clarity.numDaysCovered} dias</p>
            </div>
            {/* Bot Sessions — show only if > 5% */}
            {clarity.behavioral.botSessions > 0 && clarity.behavioral.totalTraffic > 0 && (
              <div className={`rounded-xl border bg-white p-4 ${statusBorder[Math.round((clarity.behavioral.botSessions / clarity.behavioral.totalTraffic) * 100) > 5 ? "warn" : "ok"]}`}>
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Trafego Bot</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{Math.round((clarity.behavioral.botSessions / clarity.behavioral.totalTraffic) * 100)}%</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{clarity.behavioral.botSessions.toLocaleString("pt-BR")} sessoes bot</p>
              </div>
            )}
            {/* Active Time Ratio (Responsiveness) */}
            {clarity.behavioral.activeTimeRatio > 0 && (
              <div className={`rounded-xl border bg-white p-4 ${statusBorder[clarity.behavioral.activeTimeRatio < 0.3 ? "danger" : clarity.behavioral.activeTimeRatio < 0.5 ? "warn" : "ok"]}`}>
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Responsividade</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{Math.round(clarity.behavioral.activeTimeRatio * 100)}%</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Tempo ativo / tempo total</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- FUNIL --- */}
      {funnel && funnel.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-sm font-semibold text-zinc-800">Funil de Conversao</h2>
            {hasGA4Data && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">GA4</span>}
          </div>

          {(() => {
            const funnelColors = ["#3b82f6", "#6366f1", "#818cf8", "#8b5cf6", "#a855f7", "#c084fc", "#d946ef", "#e879f9", "#f472b6"];
            const maxCount = funnel[0]?.count || 1;
            return (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 min-w-[700px] px-2">
                  {funnel.map((step, i) => {
                    const heightPct = Math.max(15, (step.count / maxCount) * 100);
                    const isBottleneck = i === bottleneckIdx && step.dropoff > 20;
                    return (
                      <div key={step.eventName} className="flex-1 flex flex-col items-center">
                        <span className="text-[11px] font-medium text-zinc-600 mb-2 text-center leading-tight h-8 flex items-end justify-center">
                          {step.step}
                        </span>
                        <div
                          className={`w-full rounded-lg flex items-center justify-center transition-all ${isBottleneck ? "ring-2 ring-red-400 ring-offset-2" : ""}`}
                          style={{
                            height: `${Math.round(heightPct * 1.2)}px`,
                            background: `linear-gradient(180deg, ${funnelColors[i % funnelColors.length]}cc 0%, ${funnelColors[i % funnelColors.length]} 100%)`,
                          }}
                        >
                          <span className="text-white font-bold text-xs">
                            {step.count >= 1000 ? `${(step.count / 1000).toFixed(1).replace(".", ",")}k` : step.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {i > 0 && step.dropoff > 0 ? (
                          <span className={`text-[10px] mt-1.5 font-semibold ${isBottleneck ? "text-red-600" : "text-red-500"}`}>
                            -{step.dropoff.toFixed(1).replace(".", ",")}%
                            {isBottleneck && " !"}
                          </span>
                        ) : i === 0 ? (
                          <span className="text-[10px] text-zinc-400 mt-1.5">entrada</span>
                        ) : (
                          <span className="text-[10px] text-zinc-300 mt-1.5">&nbsp;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Conversao geral + Abandono */}
          <div className="mt-5 pt-4 border-t border-zinc-100">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="text-center">
                <span className="text-xs text-zinc-500">Conversao geral: </span>
                <span className="text-sm font-bold text-purple-700">{convRate.toFixed(2).replace(".", ",")}%</span>
              </div>
              {summary && (
                <>
                  <div className="text-center">
                    <span className="text-xs text-zinc-500">Abandono Carrinho: </span>
                    <span className="text-sm font-bold text-amber-700">{summary.cartAbandonmentRate.toFixed(1).replace(".", ",")}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-zinc-500">Abandono Checkout: </span>
                    <span className="text-sm font-bold text-amber-700">{summary.checkoutAbandonmentRate.toFixed(1).replace(".", ",")}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ANALISE DE PAGINAS (sorted by Impact Score) --- */}
      {pageAnalysis.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-800">Analise de Paginas (Impact Score)</h3>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Dados de exemplo</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Pagina</th>
                  <th className="px-3 py-3 font-medium text-center">UX</th>
                  <th className="px-3 py-3 font-medium text-center">Impact</th>
                  <th className="px-3 py-3 font-medium text-right">Dead Clicks</th>
                  <th className="px-3 py-3 font-medium text-right">Rage Clicks</th>
                  <th className="px-3 py-3 font-medium text-right">Quickbacks</th>
                  <th className="px-3 py-3 font-medium text-right">Scroll</th>
                  <th className="px-3 py-3 font-medium text-right">Trafego</th>
                  <th className="px-5 py-3 font-medium text-right">Engajamento</th>
                </tr>
              </thead>
              <tbody>
                {visiblePages.map((page) => {
                  const scoreStatus = uxScoreStatus(page.uxScore);
                  return (
                    <tr key={page.url} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="max-w-[220px]">
                          <p className="text-xs font-medium text-zinc-700 truncate">{page.pageTitle}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{page.url}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[scoreStatus]}`}>
                          {page.uxScore}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-semibold text-zinc-700">{page.impactScore}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs text-zinc-600">{page.deadClicks.toLocaleString("pt-BR")}</span>
                        {page.deadClickRate > 0 && (
                          <span className={`text-[10px] ml-1 ${statusColors[rateStatus(page.deadClickRate)].split(" ")[0]}`}>({page.deadClickRate}%)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs text-zinc-600">{page.rageClicks.toLocaleString("pt-BR")}</span>
                        {page.rageClickRate > 0 && (
                          <span className={`text-[10px] ml-1 ${statusColors[rateStatus(page.rageClickRate)].split(" ")[0]}`}>({page.rageClickRate}%)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.quickbacks}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.scrollDepth.toFixed(0)}%</td>
                      <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{page.traffic.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-zinc-600">{formatEngagementTime(page.engagementTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pageAnalysis.length > 10 && (
            <div className="px-5 py-3 border-t border-zinc-100 text-center">
              <button
                onClick={() => setShowAllPages(!showAllPages)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium inline-flex items-center gap-1"
              >
                {showAllPages ? (
                  <>Mostrar menos <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver todas as {pageAnalysis.length} paginas <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- QUALIDADE POR CANAL DE AQUISICAO --- */}
      {channelBreakdown.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-zinc-800">Qualidade UX por Canal</h3>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full ml-auto">Dados de exemplo</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Canal</th>
                  <th className="px-3 py-3 font-medium text-right">Trafego</th>
                  <th className="px-3 py-3 font-medium text-right">Dead Click %</th>
                  <th className="px-3 py-3 font-medium text-right">Rage Click %</th>
                  <th className="px-3 py-3 font-medium text-right">Scroll</th>
                  <th className="px-3 py-3 font-medium text-right">Engajamento</th>
                  <th className="px-3 py-3 font-medium text-right">Quickbacks</th>
                  <th className="px-5 py-3 font-medium text-right">Erros JS</th>
                </tr>
              </thead>
              <tbody>
                {channelBreakdown.map((ch) => (
                  <tr key={ch.channel} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-2.5 text-xs font-medium text-zinc-700">{ch.channel}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.traffic.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[rateStatus(ch.deadClickRate)].split(" ")[0]}`}>{ch.deadClickRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[rateStatus(ch.rageClickRate)].split(" ")[0]}`}>{ch.rageClickRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.scrollDepth.toFixed(0)}%</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{formatEngagementTime(ch.engagementTime)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.quickbacks}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[scriptErrorStatus(ch.scriptErrors)].split(" ")[0]}`}>{ch.scriptErrors.toLocaleString("pt-BR")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- QUALIDADE POR CAMPANHA --- */}
      {campaignBreakdown.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-zinc-800">Qualidade UX por Campanha</h3>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full ml-auto">Dados de exemplo</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Campanha</th>
                  <th className="px-3 py-3 font-medium text-right">Trafego</th>
                  <th className="px-3 py-3 font-medium text-right">Dead Click %</th>
                  <th className="px-3 py-3 font-medium text-right">Rage Click %</th>
                  <th className="px-3 py-3 font-medium text-right">Engajamento</th>
                  <th className="px-5 py-3 font-medium text-right">Erros JS</th>
                </tr>
              </thead>
              <tbody>
                {campaignBreakdown.map((camp) => (
                  <tr key={camp.campaign} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-2.5">
                      <p className="text-xs font-medium text-zinc-700 max-w-[260px] truncate">{camp.campaign}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{camp.traffic.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[rateStatus(camp.deadClickRate)].split(" ")[0]}`}>{camp.deadClickRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[rateStatus(camp.rageClickRate)].split(" ")[0]}`}>{camp.rageClickRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{formatEngagementTime(camp.engagementTime)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`text-xs font-medium ${statusColors[scriptErrorStatus(camp.scriptErrors)].split(" ")[0]}`}>{camp.scriptErrors.toLocaleString("pt-BR")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- DIAGNOSTICO TECNICO (OS + Browser) --- */}
      {techBreakdown.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-zinc-800">Diagnostico Tecnico</h3>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full ml-auto">Dados de exemplo</span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-px lg:bg-zinc-100">
            {/* OS */}
            <div className="bg-white p-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Por Sistema Operacional</h4>
              <div className="space-y-2">
                {osTech.map((t) => {
                  const totalErrors = osTech.reduce((s, x) => s + x.scriptErrors, 0);
                  const errPct = totalErrors > 0 ? Math.round((t.scriptErrors / totalErrors) * 100) : 0;
                  return (
                    <div key={t.name} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-700">{t.name}</span>
                        <span className="text-[10px] text-zinc-400">{t.traffic.toLocaleString("pt-BR")} sess.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${statusColors[scriptErrorStatus(t.scriptErrors)].split(" ")[0]}`}>
                          {t.scriptErrors.toLocaleString("pt-BR")} erros ({errPct}%)
                        </span>
                        {t.scriptErrorRate > 0 && (
                          <span className="text-[10px] text-zinc-400">{t.scriptErrorRate}% sess.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Browser */}
            <div className="bg-white p-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Por Navegador</h4>
              <div className="space-y-2">
                {browserTech.map((t) => {
                  const totalErrors = browserTech.reduce((s, x) => s + x.scriptErrors, 0);
                  const errPct = totalErrors > 0 ? Math.round((t.scriptErrors / totalErrors) * 100) : 0;
                  return (
                    <div key={t.name} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-700">{t.name}</span>
                        <span className="text-[10px] text-zinc-400">{t.traffic.toLocaleString("pt-BR")} sess.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${statusColors[scriptErrorStatus(t.scriptErrors)].split(" ")[0]}`}>
                          {t.scriptErrors.toLocaleString("pt-BR")} erros ({errPct}%)
                        </span>
                        {t.scriptErrorRate > 0 && (
                          <span className="text-[10px] text-zinc-400">{t.scriptErrorRate}% sess.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DISPOSITIVOS (enriched) --- */}
      {clarity && clarity.deviceBreakdown.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dispositivos</h2>
            {!hasClarityData && (
              <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Dados de exemplo</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {clarity.deviceBreakdown.map((dev) => {
              const totalTraffic = clarity.deviceBreakdown.reduce((s, d) => s + d.traffic, 0);
              const pct = totalTraffic > 0 ? Math.round((dev.traffic / totalTraffic) * 100) : 0;
              const totalProblems = clarity.deviceBreakdown.reduce((s, d) => s + d.rageClicks + d.deadClicks + d.scriptErrors, 0);
              const devProblems = dev.rageClicks + dev.deadClicks + dev.scriptErrors;
              const problemPct = totalProblems > 0 ? Math.round((devProblems / totalProblems) * 100) : 0;
              const botPct = dev.traffic > 0 ? Math.round((dev.botSessions / dev.traffic) * 100) : 0;
              return (
                <div key={dev.device} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-zinc-500"><DeviceIcon device={dev.device} /></div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">{dev.device}</p>
                      <p className="text-[11px] text-zinc-400">{dev.traffic.toLocaleString("pt-BR")} sessoes ({pct}%)</p>
                    </div>
                  </div>
                  {/* Traffic vs problems insight */}
                  {problemPct > pct + 5 && (
                    <div className="mb-2 px-2 py-1 rounded bg-amber-50 border border-amber-100">
                      <p className="text-[10px] text-amber-700 font-medium">{pct}% do trafego, {problemPct}% dos problemas</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Dead Clicks</span>
                      <span className={`font-medium ${statusColors[deadClickStatus(dev.deadClicks)].split(" ")[0]}`}>{dev.deadClicks.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Rage Clicks</span>
                      <span className={`font-medium ${statusColors[rageClickStatus(dev.rageClicks)].split(" ")[0]}`}>{dev.rageClicks.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Quickbacks</span>
                      <span className={`font-medium ${statusColors[quickbackStatus(dev.quickbacks)].split(" ")[0]}`}>{dev.quickbacks}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Erros JS</span>
                      <span className={`font-medium ${statusColors[scriptErrorStatus(dev.scriptErrors)].split(" ")[0]}`}>{dev.scriptErrors.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Scroll Depth</span>
                      <span className="font-medium text-zinc-700">{dev.scrollDepth.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Engajamento</span>
                      <span className="font-medium text-zinc-700">{formatEngagementTime(dev.engagementTime)}</span>
                    </div>
                    {botPct > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Bots</span>
                        <span className={`font-medium ${botPct > 5 ? "text-amber-700" : "text-zinc-500"}`}>{botPct}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- CANAIS DE AQUISICAO (GA4) --- */}
      {channels && channels.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-800">Aquisicao por Canal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Canal</th>
                  <th className="px-3 py-3 font-medium text-right">Usuarios</th>
                  <th className="px-3 py-3 font-medium text-right">Novos</th>
                  <th className="px-3 py-3 font-medium text-right">Sessoes</th>
                  <th className="px-3 py-3 font-medium text-right">Conversoes</th>
                  <th className="px-5 py-3 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.channel} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{
                          background: ch.channel === "Organic Search" ? "#10b981"
                            : ch.channel === "Paid Search" ? "#3b82f6"
                            : ch.channel === "Direct" ? "#6366f1"
                            : ch.channel === "Organic Social" ? "#f59e0b"
                            : ch.channel === "Paid Social" ? "#8b5cf6"
                            : ch.channel === "Referral" ? "#ec4899"
                            : ch.channel === "Email" ? "#ef4444"
                            : ch.channel === "Paid Shopping" ? "#14b8a6"
                            : ch.channel === "Organic Shopping" ? "#059669"
                            : "#9ca3af"
                        }} />
                        <span className="text-xs font-medium text-zinc-700">{ch.channel}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.users.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.newUsers.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.sessions.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{ch.conversions.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-2.5 text-right text-xs font-semibold text-zinc-800">{formatBRL(ch.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TENDENCIA DIARIA --- */}
      {dailySeries && dailySeries.length > 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Tendencia Diaria do Funil</h2>
          <GA4FunnelChart data={dailySeries} />
        </div>
      )}

      {/* --- RECOMENDACOES CRO --- */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-zinc-800">Recomendacoes CRO</h2>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const cfg = severityConfig[rec.severity];
              return (
                <div key={i} className="rounded-lg border border-zinc-100 p-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} flex-shrink-0 mt-0.5`}>
                      {cfg.label}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{rec.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{rec.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
