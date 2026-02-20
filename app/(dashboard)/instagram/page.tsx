"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { IGInsightsResponse, IGMedia, IGMediaInsights, DateRange } from "@/types/api";
import { useDateRange } from "@/hooks/use-date-range";
import { defaultRange } from "@/lib/constants";
import { fmtDateSlash } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import Kpi from "@/components/ui/kpi-card";
import SortableHeader from "@/components/ui/sortable-header";
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { exportToCSV } from "@/lib/export-csv";
import { Download, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,

} from "recharts";

// ---------- Merged media type for table ----------

type MediaRow = IGMedia & Partial<IGMediaInsights>;

export default function InstagramPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [data, setData] = useState<IGInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [audienceTab, setAudienceTab] = useState<"gender" | "cities" | "countries">("gender");
  const PER_PAGE = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sortArray<T extends Record<string, any>>(arr: T[], field: string, dir: "asc" | "desc"): T[] {
    if (!field) return arr;
    return [...arr].sort((a, b) => {
      const va = a[field] ?? 0;
      const vb = b[field] ?? 0;
      if (typeof va === "string") return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return dir === "asc" ? va - vb : vb - va;
    });
  }

  // Merge media + insights
  const mediaRows = useMemo((): MediaRow[] => {
    if (!data?.media) return [];
    const insightsMap = new Map<string, IGMediaInsights>();
    for (const ins of data.mediaInsights ?? []) {
      insightsMap.set(ins.mediaId, ins);
    }
    return data.media.map((m) => ({ ...m, ...insightsMap.get(m.id) }));
  }, [data]);

  const sortedMedia = useMemo(() => sortArray(mediaRows, sortField, sortDir), [mediaRows, sortField, sortDir]);
  const totalPages = Math.ceil(sortedMedia.length / PER_PAGE);
  const pageMedia = sortedMedia.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const startIdx = page * PER_PAGE;

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  }

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instagram?startDate=${range.startDate}&endDate=${range.endDate}`);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      setData(await res.json());
    } catch {
      setError("Erro ao carregar dados do Instagram. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    setSortField("");
    setPage(0);
    loadData(range);
  }

  useEffect(() => {
    const range = defaultRange();
    loadData(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notConfigured = data?.source === "not_configured";
  const discoveryFailed = data?.source === "discovery_failed";
  const hasData = data?.source === "instagram";
  const account = data?.account;
  const daily = data?.dailyInsights ?? [];
  const totals = data?.periodTotals;

  // KPI computations
  const totalReach = daily.reduce((s, d) => s + d.reach, 0);
  const totalViews = totals?.views ?? 0;
  const avgReach = daily.length > 0 ? Math.round(totalReach / daily.length) : 0;

  const engagementRate = account && account.followersCount > 0
    ? Math.round(((totals?.totalInteractions ?? 0) / account.followersCount) * 10000) / 100
    : 0;

  // Follower growth: follower_count in daily is the NET CHANGE per day
  const followerDelta = daily.reduce((s, d) => s + d.followerCount, 0);
  const followerGrowthPct = account && account.followersCount > 0
    ? Math.round((followerDelta / account.followersCount) * 10000) / 100
    : 0;

  // Online followers (best hours)
  const onlineFollowers = data?.onlineFollowers ?? [];
  const sortedOnline = [...onlineFollowers].sort((a, b) => b.value - a.value);
  const top3Hours = sortedOnline.slice(0, 3).map((h) => `${h.hour}h`);
  const maxOnline = sortedOnline.length > 0 ? sortedOnline[0].value : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Instagram</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fmtDateSlash(dateRange.startDate)} — {fmtDateSlash(dateRange.endDate)}
            {account && (
              <span className="ml-2 text-zinc-400">@{account.username}</span>
            )}
            {loading && <span className="ml-2 text-zinc-400">Carregando...</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* ─── ERRO ─── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => loadData(dateRange)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ─── NOT CONFIGURED ─── */}
      {notConfigured && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Instagram não configurado</h3>
              <p className="text-sm text-amber-700 mt-1">
                Para conectar o Instagram, configure a variável de ambiente:
              </p>
              <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li><code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">META_ADS_ACCESS_TOKEN</code> — Token com permissões <code className="bg-amber-100 px-1 rounded text-xs">instagram_basic</code> e <code className="bg-amber-100 px-1 rounded text-xs">instagram_manage_insights</code></li>
              </ul>
              <p className="text-xs text-amber-600 mt-3">
                O token deve estar vinculado a uma Page conectada a um perfil Instagram Business/Creator.
                A conta do Instagram será descoberta automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── DISCOVERY FAILED ─── */}
      {discoveryFailed && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Conta do Instagram não encontrada</h3>
              <p className="text-sm text-amber-700 mt-1">
                O token Meta existe, mas não foi possível descobrir a conta do Instagram automaticamente.
                Configure o ID manualmente:
              </p>
              <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li><code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">INSTAGRAM_BUSINESS_ACCOUNT_ID</code> — ID numérico da conta Instagram Business</li>
              </ul>
              <p className="text-xs text-amber-600 mt-3">
                Para encontrar o ID: acesse o Graph API Explorer, faça GET em <code className="bg-amber-100 px-1 rounded text-xs">/me/accounts?fields=instagram_business_account</code> com o token.
                Ou verifique se o token tem a permissão <code className="bg-amber-100 px-1 rounded text-xs">pages_show_list</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOADING ─── */}
      {loading && !data && (
        <>
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-zinc-200 rounded animate-pulse" />
                <div className="h-4 w-60 bg-zinc-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <ChartSkeleton /><ChartSkeleton />
          </div>
          <TableSkeleton rows={8} />
        </>
      )}

      {/* ─── SEÇÃO 1: HEADER DA CONTA ─── */}
      {account && hasData && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-4">
            {account.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.profilePictureUrl}
                alt={account.username}
                className="w-16 h-16 rounded-full object-cover border-2 border-zinc-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                {account.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900">@{account.username}</h2>
                {account.name && <span className="text-sm text-zinc-500">{account.name}</span>}
              </div>
              {account.biography && (
                <p className="text-sm text-zinc-600 mt-0.5 line-clamp-2 max-w-lg">{account.biography}</p>
              )}
              <div className="flex gap-4 mt-2 text-sm text-zinc-500">
                <span><strong className="text-zinc-900">{account.followersCount.toLocaleString("pt-BR")}</strong> seguidores</span>
                <span><strong className="text-zinc-900">{account.followsCount.toLocaleString("pt-BR")}</strong> seguindo</span>
                <span><strong className="text-zinc-900">{account.mediaCount.toLocaleString("pt-BR")}</strong> publicações</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEÇÃO 2: KPIs ─── */}
      {account && hasData && !loading && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Kpi
            title="Seguidores"
            value={account.followersCount.toLocaleString("pt-BR")}
            subtitle={followerDelta !== 0
              ? `${followerDelta > 0 ? "+" : ""}${followerDelta.toLocaleString("pt-BR")} no período`
              : "Sem variação no período"}
          />
          <Kpi
            title="Alcance"
            value={totalReach.toLocaleString("pt-BR")}
            subtitle={`Média diária: ${avgReach.toLocaleString("pt-BR")}`}
          />
          <Kpi
            title="Visualizações"
            value={totalViews.toLocaleString("pt-BR")}
            subtitle={`${(totals?.accountsEngaged ?? 0).toLocaleString("pt-BR")} contas engajadas`}
          />
          <Kpi
            title="Engajamento"
            value={`${engagementRate.toFixed(2).replace(".", ",")}%`}
            subtitle={`${(totals?.totalInteractions ?? 0).toLocaleString("pt-BR")} interações`}
          />
          <Kpi
            title="Crescimento"
            value={`${followerDelta >= 0 ? "+" : ""}${followerDelta.toLocaleString("pt-BR")}`}
            subtitle={`${followerGrowthPct >= 0 ? "+" : ""}${followerGrowthPct.toFixed(2).replace(".", ",")}% variação`}
            status={followerDelta > 0 ? "ok" : followerDelta < 0 ? "danger" : undefined}
          />
        </div>
      )}

      {/* ─── SEÇÃO 3: GRÁFICOS ─── */}
      {daily.length > 0 && !loading && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Novos Seguidores por Dia */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">Novos Seguidores por Dia</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T12:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Novos seguidores"]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(label: any) => fmtDateSlash(String(label))}
                />
                <Bar dataKey="followerCount" radius={[4, 4, 0, 0]}>
                  {daily.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.followerCount > 0 ? "#8b5cf6" : entry.followerCount < 0 ? "#ef4444" : "#d4d4d8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Alcance Diário */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">Alcance Diário</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T12:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Alcance"]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(label: any) => fmtDateSlash(String(label))}
                />
                <Area type="monotone" dataKey="reach" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} name="Alcance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── SEÇÃO 4: TABELA DE PUBLICAÇÕES ─── */}
      {data && hasData && mediaRows.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              Publicações
              <span className="ml-2 text-zinc-400 font-normal">
                Top {mediaRows.length} por engajamento
              </span>
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => exportToCSV(
                  mediaRows.map((m) => ({
                    caption: (m.caption ?? "").slice(0, 100),
                    mediaType: formatMediaType(m.mediaType),
                    date: fmtDateSlash(m.timestamp.slice(0, 10)),
                    likeCount: m.likeCount,
                    commentsCount: m.commentsCount,
                    saved: m.saved ?? 0,
                    shares: m.shares ?? 0,
                    reach: m.reach ?? 0,
                    permalink: m.permalink,
                  })),
                  [
                    { key: "caption", label: "Legenda" },
                    { key: "mediaType", label: "Tipo" },
                    { key: "date", label: "Data" },
                    { key: "likeCount", label: "Curtidas" },
                    { key: "commentsCount", label: "Comentários" },
                    { key: "saved", label: "Salvos" },
                    { key: "shares", label: "Compart." },
                    { key: "reach", label: "Alcance" },
                    { key: "permalink", label: "Link" },
                  ],
                  "instagram-publicacoes.csv",
                )}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs text-zinc-600 hover:bg-white"
                title="Exportar CSV"
              >
                <Download size={12} /> CSV
              </button>
              {totalPages > 1 && (
                <>
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                  <span className="text-xs text-zinc-500">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2.5 py-1 rounded-lg border text-xs hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] text-zinc-500">
                  <th className="py-2.5 px-5 text-left w-8">#</th>
                  <th className="py-2.5 pr-2 text-left">Publicação</th>
                  <th className="py-2.5 px-2 text-left w-24">Tipo</th>
                  <th className="py-2.5 px-2 text-left w-24">Data</th>
                  <SortableHeader label="Curtidas" field="likeCount" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Coment." field="commentsCount" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Salvos" field="saved" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Compart." field="shares" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Alcance" field="reach" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  <th className="py-2.5 px-5 text-center w-10">Link</th>
                </tr>
              </thead>
              <tbody>
                {pageMedia.length === 0 && (
                  <tr><td colSpan={10} className="py-8 text-center text-zinc-400 text-sm">
                    Nenhuma publicação encontrada.
                  </td></tr>
                )}
                {pageMedia.map((m, i) => (
                  <tr key={m.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <td className="py-2 px-5 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                    <td className="py-2 pr-2 max-w-[260px]">
                      <div className="flex items-center gap-2">
                        {(m.thumbnailUrl || m.mediaUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.thumbnailUrl || m.mediaUrl}
                            alt=""
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-100 flex-shrink-0" />
                        )}
                        <span className="truncate text-zinc-700 text-xs" title={m.caption ?? ""}>
                          {(m.caption ?? "Sem legenda").slice(0, 60)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs text-zinc-500">{formatMediaType(m.mediaType)}</td>
                    <td className="py-2 px-2 text-xs text-zinc-500 tabular-nums">{fmtDateSlash(m.timestamp.slice(0, 10))}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.likeCount.toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.commentsCount.toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{(m.saved ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{(m.shares ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{(m.reach ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-5 text-center">
                      <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-700">
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 py-3 border-t border-zinc-100">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
              <span className="text-xs text-zinc-500 flex items-center">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">Próximo</button>
            </div>
          )}
        </div>
      )}

      {/* ─── SEÇÃO 5: AUDIÊNCIA ─── */}
      {data && hasData && (data.audienceGenderAge?.length || data.audienceCountries?.length || data.audienceCities?.length) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-800">Audiência</h3>
            <div className="flex gap-1">
              {([
                { key: "gender" as const, label: "Gênero & Idade" },
                { key: "cities" as const, label: "Cidades" },
                { key: "countries" as const, label: "Países" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAudienceTab(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    audienceTab === tab.key
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {audienceTab === "gender" && (data.audienceGenderAge?.length ?? 0) > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={data.audienceGenderAge!.slice(0, 20)}
                margin={{ left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v: string) => v.replace(".", " ")}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Seguidores"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.audienceGenderAge!.slice(0, 20).map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.label.startsWith("F") ? "#ec4899" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {audienceTab === "cities" && (data.audienceCities?.length ?? 0) > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={data.audienceCities!.slice(0, 10)}
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Seguidores"]}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {audienceTab === "countries" && (data.audienceCountries?.length ?? 0) > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={data.audienceCountries!.slice(0, 10)}
                margin={{ left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={50} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Seguidores"]}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          <p className="text-[11px] text-zinc-400 mt-3">
            Dados demográficos atualizados diariamente (snapshot do dia anterior)
          </p>
        </div>
      )}

      {/* ─── SEÇÃO 6: MELHOR HORÁRIO PARA POSTAR ─── */}
      {onlineFollowers.length > 0 && !loading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4">Melhor Horário para Postar</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={onlineFollowers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}h`} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "Seguidores online"]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => `${label}h`}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {onlineFollowers.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.value >= maxOnline * 0.85 ? "#10b981" : "#d4d4d8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <p className="text-sm text-zinc-600">
              Melhores horários: <strong className="text-zinc-900">{top3Hours.join(", ")}</strong>
            </p>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Baseado em quando seus seguidores estão online
          </p>
        </div>
      )}

      {/* ─── DISCLAIMER ─── */}
      {data && hasData && (
        <p className="text-xs text-zinc-400 text-center">
          Dados obtidos via Instagram Graph API. Atualizado em {data.updatedAt ? new Date(data.updatedAt).toLocaleString("pt-BR") : "—"}.
        </p>
      )}
    </div>
  );
}

// ---------- Helpers ----------

function formatMediaType(type: string): string {
  const map: Record<string, string> = {
    IMAGE: "Imagem",
    VIDEO: "Vídeo",
    CAROUSEL_ALBUM: "Carrossel",
  };
  return map[type] ?? type;
}
