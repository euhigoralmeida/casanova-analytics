"use client";

import { useState } from "react";
import type { InfluencerLookupResponse, InfluencerLookupPost } from "@/lib/influencer-types";
import IQSGauge from "@/components/influencers/iqs-gauge";
import { TierBadge } from "@/components/influencers/tier-badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Search,
  Loader2,
  AlertTriangle,
  Users,
  HelpCircle,
} from "lucide-react";

// ---------- Helpers ----------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---------- Tooltip component ----------

function InfoTip({ text, align = "center" }: { text: string; align?: "center" | "left" | "right" }) {
  const posClass =
    align === "right" ? "right-0" :
    align === "left" ? "left-0" :
    "left-1/2 -translate-x-1/2";

  return (
    <span className="group relative inline-flex ml-1 cursor-help">
      <HelpCircle size={11} className="text-zinc-300 group-hover:text-emerald-500 transition-colors" />
      <span className={`pointer-events-none absolute bottom-full ${posClass} mb-1.5 w-52 rounded-lg bg-zinc-800 px-2.5 py-2 text-[10px] leading-snug text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-30 text-left`}>
        {text}
      </span>
    </span>
  );
}

// ---------- Post engagement chart ----------

function PostEngagementChart({ posts }: { posts: InfluencerLookupPost[] }) {
  const chartPosts = posts.slice(0, 12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = [...chartPosts].reverse().map((p: any, i: number) => ({
    name: fmtDateShort(p.timestamp) || `#${i + 1}`,
    likes: p.likes,
    comments: p.comments,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} barGap={1}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#a1a1aa" />
        <YAxis tick={{ fontSize: 10 }} stroke="#a1a1aa" width={40} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            formatNumber(Number(value)),
            name === "likes" ? "Likes" : "Comentários",
          ]}
        />
        <Bar dataKey="likes" fill="#10b981" radius={[3, 3, 0, 0]} name="likes" />
        <Bar dataKey="comments" fill="#6ee7b7" radius={[3, 3, 0, 0]} name="comments" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- IQS Radar chart ----------

function IQSRadar({ data }: { data: InfluencerLookupResponse }) {
  const radarData = [
    { metric: "Engajamento", value: data.iqsBreakdown.engajamento.score, fullMark: 100 },
    { metric: "Relevância", value: data.iqsBreakdown.relevancia.score, fullMark: 100 },
    { metric: "Performance", value: data.iqsBreakdown.performance.score, fullMark: 100 },
    { metric: "Audiência", value: data.iqsBreakdown.qualidadeAudiencia.score, fullMark: 100 },
    { metric: "Conteúdo", value: data.iqsBreakdown.conteudo.score, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData} outerRadius="75%">
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#71717a" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#d4d4d8" />
        <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ---------- Main page ----------

export default function InfluencersPage() {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InfluencerLookupResponse | null>(null);

  async function handleSearch() {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/influencers/lookup?handle=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao buscar perfil");
        return;
      }
      setData(json as InfluencerLookupResponse);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 pb-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Influenciadores <span className="text-xs font-medium text-zinc-400 ml-1">(Beta)</span></h2>
        <p className="text-xs text-zinc-500">Busque um perfil do Instagram para analisar métricas públicas</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 max-w-lg">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-zinc-400 text-sm">@</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="handle do instagram"
            className="w-full pl-7 pr-3 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !handle.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-4 max-w-lg">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-50 border-2 border-dashed border-zinc-200 flex items-center justify-center mb-4">
            <Users size={32} className="text-zinc-300" />
          </div>
          <p className="text-sm font-medium text-zinc-500">Pesquise um perfil para começar</p>
          <p className="text-xs text-zinc-400 mt-1">Funciona com contas Business ou Creator públicas</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-start gap-4 rounded-xl border bg-white p-5">
            <div className="w-16 h-16 rounded-full bg-zinc-100" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-40 bg-zinc-100 rounded" />
              <div className="h-3 w-24 bg-zinc-100 rounded" />
              <div className="h-3 w-72 bg-zinc-100 rounded" />
            </div>
            <div className="w-[100px] h-[100px] rounded-full bg-zinc-100" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] bg-zinc-100 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-zinc-100 rounded-xl" />
            <div className="h-64 bg-zinc-100 rounded-xl" />
          </div>
          <div className="h-80 bg-zinc-100 rounded-xl" />
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-5">
          {/* Profile card */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {data.profile.profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.profile.profilePictureUrl}
                  alt={data.profile.name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center">
                  <Users size={24} className="text-zinc-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-zinc-900">{data.profile.name}</h3>
                  <TierBadge tier={data.profile.tier} />
                </div>
                <p className="text-sm text-zinc-500">{data.profile.handle}</p>
                {data.profile.bio && (
                  <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 max-w-lg">{data.profile.bio}</p>
                )}
              </div>
              <div className="text-center shrink-0">
                <IQSGauge score={data.iqs} size="md" />
                <div className="flex items-center justify-center mt-1 gap-0.5">
                  <span className="text-[10px] text-zinc-400">IQS parcial</span>
                  <InfoTip
                    text="Influencer Quality Score (0-100) calculado com dados públicos. Métricas como saves, reach e audiência usam estimativas baseadas em benchmarks do mercado."
                    align="right"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <KpiCard label="Seguidores" value={formatNumber(data.profile.followersCount)} tip="Total de seguidores do perfil" />
            <KpiCard label="Seguindo" value={formatNumber(data.profile.followingCount)} tip="Contas que o perfil segue" />
            <KpiCard label="Publicações" value={formatNumber(data.profile.mediaCount)} tip="Total de publicações no perfil" />
            <KpiCard
              label="Eng. Rate"
              value={`${data.metrics.engagementRate}%`}
              tip="Média de (likes + comentários) / seguidores nos últimos 30 posts"
              highlight={data.metrics.engagementRate >= 3 ? "green" : data.metrics.engagementRate >= 1 ? "amber" : "red"}
            />
            <KpiCard label="Posts/Sem" value={String(data.metrics.postsPerWeek)} tip="Frequência média de publicações por semana" />
            <KpiCard
              label="Ratio F/F"
              value={String(data.metrics.followersFollowingRatio)}
              tip="Seguidores dividido por seguindo. Quanto maior, mais autoridade. Acima de 5x é excelente."
              highlight={data.metrics.followersFollowingRatio >= 5 ? "green" : data.metrics.followersFollowingRatio >= 2 ? "amber" : undefined}
            />
          </div>

          {/* Two columns: Engagement + IQS Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Métricas de Engajamento</h4>
                <InfoTip text="Calculadas a partir dos últimos 30 posts públicos do perfil." align="left" />
              </div>
              <div className="grid grid-cols-2 gap-y-5 gap-x-6">
                <MetricItem label="Avg Likes" value={formatNumber(data.metrics.avgLikes)} tip="Média de likes por publicação" />
                <MetricItem label="Avg Comentários" value={formatNumber(data.metrics.avgComments)} tip="Média de comentários por publicação" />
                <MetricItem label="Comment/Like" value={`${(data.metrics.commentToLikeRatio * 100).toFixed(1)}%`} tip="Comentários/likes. Acima de 2% indica audiência engajada." />
                <MetricItem label="Formatos" value={`${data.metrics.formatDiversity} ${data.metrics.formatDiversity === 1 ? "tipo" : "tipos"}`} tip="Diversidade de formatos (Imagem, Vídeo, Carrossel)." />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Qualidade do Perfil</h4>
                <InfoTip text="Radar das 5 dimensões do IQS. Quanto maior a área, melhor a qualidade geral." align="left" />
              </div>
              <IQSRadar data={data} />
            </div>
          </div>

          {/* Two columns: Engagement chart + IQS Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.recentPosts.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Engajamento por Post</h4>
                  <InfoTip text="Likes e comentários nos últimos posts. Identifica consistência ou picos." align="left" />
                </div>
                <PostEngagementChart posts={data.recentPosts} />
              </div>
            )}

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">IQS Detalhado</h4>
                <InfoTip text="Pontuação em cada dimensão do IQS (0-100). Peso indicado entre parênteses." align="left" />
              </div>
              <div className="space-y-3">
                {[
                  data.iqsBreakdown.engajamento,
                  data.iqsBreakdown.relevancia,
                  data.iqsBreakdown.performance,
                  data.iqsBreakdown.qualidadeAudiencia,
                  data.iqsBreakdown.conteudo,
                ].map((comp) => (
                  <div key={comp.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">
                        {comp.name}
                        <span className="text-zinc-300 ml-1">({Math.round(comp.weight * 100)}%)</span>
                      </span>
                      <span className="text-xs font-bold" style={{
                        color: comp.score >= 60 ? "#10b981" : comp.score >= 40 ? "#f59e0b" : "#ef4444",
                      }}>{comp.score}</span>
                    </div>
                    <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${comp.score}%`,
                          backgroundColor: comp.score >= 60 ? "#10b981" : comp.score >= 40 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function KpiCard({ label, value, tip, highlight }: {
  label: string;
  value: string;
  tip: string;
  highlight?: "green" | "amber" | "red";
}) {
  const borderClass = highlight === "green"
    ? "border-emerald-200 bg-emerald-50/40"
    : highlight === "amber"
      ? "border-amber-200 bg-amber-50/40"
      : highlight === "red"
        ? "border-red-200 bg-red-50/40"
        : "border-zinc-200 bg-white";

  return (
    <div className={`rounded-xl border p-3 text-center shadow-sm ${borderClass}`}>
      <div className="flex items-center justify-center gap-0.5">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</p>
        <InfoTip text={tip} />
      </div>
      <p className="text-lg font-bold text-zinc-900 mt-1">{value}</p>
    </div>
  );
}

function MetricItem({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div>
      <div className="flex items-center gap-0.5">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</p>
        <InfoTip text={tip} />
      </div>
      <p className="text-sm font-bold text-zinc-900 mt-0.5">{value}</p>
    </div>
  );
}
