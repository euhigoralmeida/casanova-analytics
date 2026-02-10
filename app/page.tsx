"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* =========================
   Utils (formatação)
========================= */
function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function fmtConv(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "0";
  if (Number.isInteger(rounded)) return rounded.toLocaleString("pt-BR");
  return rounded.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  // Usar data local (não UTC) para evitar erro de +/- 1 dia
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/* =========================
   Tipos
========================= */
type DateRange = {
  startDate: string; // yyyy-mm-dd
  endDate: string;
  label: string;
  preset?: string; // "7d" | "today" | "yesterday" | etc for API
};

type ApiResponse = {
  sku: string;
  period: string;
  source: "google-ads" | "mock";
  skuTitle: string;
  updatedAt: string;
  cards: {
    roas: number;
    cpa: number;
    arpur: number;
    marginPct: number;
    revenue: number;
    ads: number;
    grossProfit: number;
    profitAfterAds: number;
    stock: number;
    leadTimeDays: number;
    cpc: number;
    cpm: number;
    conversions: number;
    clicks: number;
    convRate: number;
  };
  alerts: { title: string; description: string; severity: "danger" | "warn" | "info" }[];
  funnel: { etapa: string; qtd: number; taxa: number; custo: number | null }[];
};

type OverviewResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  totalSkus: number;
  accountTotals?: {
    ads: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  shoppingTotals?: {
    ads: number;
    revenue: number;
  };
  meta: {
    revenueTarget: number;
    revenueActual: number;
    adsActual?: number;
    roasTarget: number;
    roasActual: number;
    marginTarget: number;
    marginActual: number;
  };
  skus: {
    sku: string;
    nome: string;
    revenue: number;
    ads: number;
    roas: number;
    cpa: number;
    marginPct: number;
    stock: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    status: "escalar" | "manter" | "pausar";
    ml: { price: number; ecomPrice: number; mlSales: number };
  }[];
};

type SmartAlertItem = {
  id: string;
  category: "account" | "campaign" | "sku" | "trend";
  severity: "danger" | "warn" | "info" | "success";
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  deltaPct: number;
  entityName?: string;
  entityId?: string;
  recommendation?: string;
};

type SmartAlertsResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  currentPeriod: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  alerts: SmartAlertItem[];
  summary: { total: number; danger: number; warn: number; info: number; success: number };
};

type CampaignData = {
  campaignId: string;
  campaignName: string;
  channelType: string;
  status: string;
  impressions: number;
  clicks: number;
  costBRL: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  cpc: number;
  ctr: number;
};

type CampaignsResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  campaigns: CampaignData[];
};

type TimeSeriesPoint = {
  date: string;
  revenue: number;
  cost: number;
  roas: number;
  conversions: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
};

type TimeSeriesResponse = {
  scope: string;
  sku?: string;
  period: string;
  source: "google-ads" | "mock";
  series: TimeSeriesPoint[];
};

type GA4FunnelStep = {
  step: string;
  eventName: string;
  count: number;
  rate: number;
  dropoff: number;
};

type GA4SummaryData = {
  sessions: number;
  users: number;
  newUsers: number;
  purchases: number;
  purchaseRevenue: number;
  avgOrderValue: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
};

type GA4DailyPoint = {
  date: string;
  sessions: number;
  pageViews: number;
  viewItems: number;
  addToCarts: number;
  checkouts: number;
  shippingInfos: number;
  paymentInfos: number;
  purchases: number;
  purchaseRevenue: number;
};

type ChannelAcquisition = {
  channel: string;
  users: number;
  newUsers: number;
  sessions: number;
  conversions: number;
  revenue: number;
};

type GA4DataResponse = {
  source: "ga4" | "not_configured";
  updatedAt?: string;
  funnel?: GA4FunnelStep[];
  overallConversionRate?: number;
  summary?: GA4SummaryData;
  dailySeries?: GA4DailyPoint[];
  channelAcquisition?: ChannelAcquisition[];
};

/* =========================
   Helpers de status
========================= */
type KpiStatus = "ok" | "warn" | "danger" | undefined;

function roasStatus(v: number): KpiStatus {
  if (v < 5) return "danger";
  if (v < 7) return "warn";
  return "ok";
}

function cpaStatus(v: number): KpiStatus {
  if (v === 0) return undefined;
  if (v > 80) return "danger";
  if (v > 60) return "warn";
  return "ok";
}

function marginStatus(v: number): KpiStatus {
  if (v < 25) return "warn";
  return "ok";
}

const alertColors = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

const smartAlertStyles: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  danger: { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", icon: "⚠" },
  warn: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", icon: "⚡" },
  info: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", icon: "ℹ" },
  success: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800", icon: "✓" },
};

const categoryLabels: Record<string, string> = {
  account: "Conta",
  campaign: "Campanha",
  sku: "SKU",
  trend: "Tendência",
};

/* =========================
   Presets de período
========================= */
// Presets alinhados com o Google Ads:
// - "Últimos 7 dias" = hoje - 6 até hoje (7 dias incluindo hoje)
// - "Últimos 14 dias" = hoje - 13 até hoje (14 dias incluindo hoje)
// - etc.
function getPresets(): { label: string; preset: string; range: () => { start: Date; end: Date } }[] {
  return [
    {
      label: "Hoje",
      preset: "today",
      range: () => {
        const d = new Date();
        return { start: d, end: d };
      },
    },
    {
      label: "Ontem",
      preset: "yesterday",
      range: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { start: new Date(d), end: new Date(d) };
      },
    },
    {
      label: "Últimos 7 dias",
      preset: "7d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6); // 7 dias incluindo hoje
        return { start, end };
      },
    },
    {
      label: "Últimos 14 dias",
      preset: "14d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 13); // 14 dias incluindo hoje
        return { start, end };
      },
    },
    {
      label: "Últimos 30 dias",
      preset: "30d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29); // 30 dias incluindo hoje
        return { start, end };
      },
    },
    {
      label: "Este mês",
      preset: "this_month",
      range: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
      },
    },
    {
      label: "Mês passado",
      preset: "last_month",
      range: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end };
      },
    },
    {
      label: "Últimos 60 dias",
      preset: "60d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 59);
        return { start, end };
      },
    },
    {
      label: "Últimos 90 dias",
      preset: "90d",
      range: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 89);
        return { start, end };
      },
    },
  ];
}

function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6); // 7 dias incluindo hoje
  return { startDate: fmtDate(start), endDate: fmtDate(end), label: "Últimos 7 dias", preset: "7d" };
}

/* =========================
   Helpers do calendário
========================= */
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function isInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

/* =========================
   Página
========================= */
export default function Home() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [sku, setSku] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuPage, setSkuPage] = useState(0);
  const [viewMode, setViewMode] = useState<"skus" | "campaigns">("skus");
  const [campaigns, setCampaigns] = useState<CampaignsResponse | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsResponse | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4DataResponse | null>(null);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterCampStatus, setFilterCampStatus] = useState("all");
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const SKUS_PER_PAGE = 20;

  // Sempre enviar startDate/endDate explícitos para garantir alinhamento com Google Ads
  const buildQueryParams = useCallback((range: DateRange, s: string) => {
    const params = new URLSearchParams();
    params.set("period", range.preset ?? "custom");
    params.set("startDate", range.startDate);
    params.set("endDate", range.endDate);
    if (s) params.set("sku", s);
    return params.toString();
  }, []);

  const buildOverviewParams = useCallback((range: DateRange) => {
    const params = new URLSearchParams();
    params.set("period", range.preset ?? "custom");
    params.set("startDate", range.startDate);
    params.set("endDate", range.endDate);
    return params.toString();
  }, []);

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

  const filteredSkus = useMemo(() => {
    if (!overview) return [];
    let list = overview.skus;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.sku.toLowerCase().includes(q) || s.nome.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") {
      list = list.filter((s) => s.status === filterStatus);
    }
    return sortArray(list, sortField, sortDir);
  }, [overview, searchQuery, filterStatus, sortField, sortDir]);

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    let list = campaigns.campaigns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    if (filterChannel !== "all") {
      list = list.filter((c) => c.channelType === filterChannel);
    }
    if (filterCampStatus !== "all") {
      list = list.filter((c) => c.status === filterCampStatus);
    }
    return sortArray(list, sortField, sortDir);
  }, [campaigns, searchQuery, filterChannel, filterCampStatus, sortField, sortDir]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setSkuPage(0);
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterChannel("all");
    setFilterCampStatus("all");
    setSortField("");
    setSkuPage(0);
  }

  async function loadMetrics(range: DateRange, s: string) {
    setLoading(true);
    setError(null);
    try {
      const tsParams = new URLSearchParams();
      tsParams.set("period", range.preset ?? "custom");
      tsParams.set("startDate", range.startDate);
      tsParams.set("endDate", range.endDate);
      tsParams.set("scope", "account");

      const [metricsRes, overviewRes, tsRes, campsRes, alertsRes, ga4Res] = await Promise.all([
        fetch(`/api/metrics?${buildQueryParams(range, s)}`),
        fetch(`/api/overview?${buildOverviewParams(range)}`),
        fetch(`/api/timeseries?${tsParams.toString()}`),
        fetch(`/api/campaigns?${buildOverviewParams(range)}`),
        fetch(`/api/alerts?${buildOverviewParams(range)}`).catch(() => null),
        fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).catch(() => null),
      ]);
      if (!metricsRes.ok || !overviewRes.ok) throw new Error("Erro ao carregar dados");
      const [metricsJson, overviewJson] = await Promise.all([
        metricsRes.json(),
        overviewRes.json(),
      ]);
      setData(metricsJson);
      setOverview(overviewJson);
      if (tsRes.ok) {
        setTimeseries(await tsRes.json());
      }
      if (campsRes.ok) {
        setCampaigns(await campsRes.json());
      }
      if (alertsRes?.ok) {
        setSmartAlerts(await alertsRes.json());
      }
      if (ga4Res?.ok) {
        setGa4Data(await ga4Res.json());
      }
    } catch {
      setError("Não foi possível carregar os dados. Verifique se o servidor está rodando.");
    } finally {
      setLoading(false);
    }
  }

  function selectSku(s: string) {
    setSku(s);
    setViewMode("skus");
    loadMetrics(dateRange, s);
  }

  function selectCampaign(campId: string) {
    setSelectedCampaign(campId);
    // Carregar time series da campanha selecionada
    const tsParams = new URLSearchParams();
    tsParams.set("period", dateRange.preset ?? "custom");
    tsParams.set("startDate", dateRange.startDate);
    tsParams.set("endDate", dateRange.endDate);
    tsParams.set("scope", "campaign");
    tsParams.set("campaignId", campId);
    fetch(`/api/timeseries?${tsParams.toString()}`)
      .then((r) => r.json())
      .then((tsJson: TimeSeriesResponse) => setTimeseries(tsJson))
      .catch(() => {});
  }

  function switchToAccountTimeSeries() {
    setSelectedCampaign(null);
    const tsParams = new URLSearchParams();
    tsParams.set("period", dateRange.preset ?? "custom");
    tsParams.set("startDate", dateRange.startDate);
    tsParams.set("endDate", dateRange.endDate);
    tsParams.set("scope", "account");
    fetch(`/api/timeseries?${tsParams.toString()}`)
      .then((r) => r.json())
      .then((tsJson: TimeSeriesResponse) => setTimeseries(tsJson))
      .catch(() => {});
  }

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    setSelectedCampaign(null);
    resetFilters();
    loadMetrics(range, sku);
  }

  useEffect(() => {
    const range = defaultRange();
    fetch(`/api/overview?${buildOverviewParams(range)}`)
      .then((r) => r.json())
      .then((overviewJson: OverviewResponse) => {
        setOverview(overviewJson);
        const firstSku = overviewJson.skus[0]?.sku ?? "27290BR-CP";
        setSku(firstSku);

        const tsParams = new URLSearchParams();
        tsParams.set("period", range.preset ?? "custom");
        tsParams.set("startDate", range.startDate);
        tsParams.set("endDate", range.endDate);
        tsParams.set("scope", "account");

        return Promise.all([
          fetch(`/api/metrics?${buildQueryParams(range, firstSku)}`).then((r) => r.json()),
          fetch(`/api/timeseries?${tsParams.toString()}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/campaigns?${buildOverviewParams(range)}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/alerts?${buildOverviewParams(range)}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/ga4?startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json()).catch(() => null),
        ]);
      })
      .then(([metricsJson, tsJson, campsJson, alertsJson, ga4Json]: [ApiResponse, TimeSeriesResponse | null, CampaignsResponse | null, SmartAlertsResponse | null, GA4DataResponse | null]) => {
        setData(metricsJson);
        if (tsJson) setTimeseries(tsJson);
        if (campsJson) setCampaigns(campsJson);
        if (alertsJson) setSmartAlerts(alertsJson);
        if (ga4Json) setGa4Data(ga4Json);
      })
      .catch(() => {
        setError("Não foi possível carregar os dados.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* HEADER */}
      <header className="bg-white border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center">
          <div className="flex flex-col items-start">
            <Image src="/logo-casanova.png" alt="Casanova" width={160} height={38} className="h-8 sm:h-9 w-auto" priority />
            <p className="text-[10px] text-zinc-400 tracking-[0.25em] uppercase -mt-0.5" style={{ marginLeft: "27%" }}>Analytics</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        {/* FILTROS */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* CALENDÁRIO */}
          <DateRangePicker
            value={dateRange}
            onChange={applyDateRange}
            loading={loading}
          />

          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-zinc-600">SKU</p>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadMetrics(dateRange, sku)}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-zinc-600">Status</p>
            <p className="mt-2 text-sm">
              {loading ? (
                <span className="inline-flex items-center gap-2 text-zinc-500">
                  <svg className="animate-spin h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Carregando...
                </span>
              ) : error ? error : data ? `Atualizado às ${new Date(data.updatedAt).toLocaleTimeString("pt-BR")}` : "Aguardando dados..."}
            </p>
            {overview && (
              <p className="mt-1 text-xs text-zinc-400">
                Fonte: {overview.source === "google-ads" ? "Google Ads" : "Dados mock"}
                {overview.source === "google-ads" && ` • ${overview.totalSkus} SKUs ativos`}
              </p>
            )}
          </div>
        </section>

        {/* ERRO */}
        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-800">Erro</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => loadMetrics(dateRange, sku)}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex-shrink-0"
            >
              Tentar novamente
            </button>
          </section>
        )}

        {/* ALERTAS INTELIGENTES */}
        {smartAlerts && smartAlerts.alerts.length > 0 && (
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold">Alertas Inteligentes</h2>
                {smartAlerts.summary.danger > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    {smartAlerts.summary.danger} crítico{smartAlerts.summary.danger > 1 ? "s" : ""}
                  </span>
                )}
                {smartAlerts.summary.warn > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    {smartAlerts.summary.warn} aviso{smartAlerts.summary.warn > 1 ? "s" : ""}
                  </span>
                )}
                {smartAlerts.summary.success > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    {smartAlerts.summary.success} positivo{smartAlerts.summary.success > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>vs {smartAlerts.previousPeriod.start.split("-").reverse().join("/")} — {smartAlerts.previousPeriod.end.split("-").reverse().join("/")}</span>
                <button
                  onClick={() => setAlertsCollapsed((c) => !c)}
                  className="text-zinc-500 hover:text-zinc-700 underline"
                >
                  {alertsCollapsed ? "Expandir" : "Recolher"}
                </button>
              </div>
            </div>
            {!alertsCollapsed && (
              <div className="space-y-2">
                {smartAlerts.alerts.map((alert) => {
                  const sc = smartAlertStyles[alert.severity];
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-3 ${sc.border} ${sc.bg}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="mt-0.5 flex-shrink-0">{sc.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium text-sm ${sc.text}`}>{alert.title}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                                {categoryLabels[alert.category]}
                              </span>
                            </div>
                            <p className="text-xs opacity-75 mt-0.5">{alert.description}</p>
                            {alert.recommendation && (
                              <p className="text-xs mt-1 font-medium opacity-90">
                                Recomendação: {alert.recommendation}
                              </p>
                            )}
                            {alert.category === "sku" && alert.entityId && (
                              <button
                                onClick={() => selectSku(alert.entityId!)}
                                className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Ver detalhes do SKU {alert.entityId}
                              </button>
                            )}
                          </div>
                        </div>
                        {alert.deltaPct !== 0 && (
                          <span className={`flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded ${alert.deltaPct < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {alert.deltaPct < 0 ? "↓" : "↑"} {Math.abs(alert.deltaPct)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TOTAIS DA CONTA + METAS */}
        {overview && (
          <section className="rounded-xl border bg-white p-4 space-y-3">
            {overview.accountTotals && (
              <>
                <h2 className="font-semibold">Totais da Conta Google Ads</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-zinc-500 text-xs">Gasto Ads</div>
                    <div className="font-semibold text-lg">{formatBRL(overview.accountTotals.ads)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-zinc-500 text-xs">Impressões</div>
                    <div className="font-semibold text-lg">{overview.accountTotals.impressions.toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-zinc-500 text-xs">Cliques</div>
                    <div className="font-semibold text-lg">{overview.accountTotals.clicks.toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-zinc-500 text-xs">Conversões</div>
                    <div className="font-semibold text-lg">{(Math.round(overview.accountTotals.conversions * 100) / 100).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
                <div className="border-t my-2" />
              </>
            )}
            <h2 className="font-semibold">Progresso vs Meta Mensal</h2>
            <ProgressBar
              label="Faturamento"
              actual={overview.meta.revenueActual}
              target={overview.meta.revenueTarget}
              format={(v) => formatBRL(v)}
            />
            <ProgressBar
              label="ROAS médio"
              actual={overview.meta.roasActual}
              target={overview.meta.roasTarget}
              format={(v) => v.toFixed(1)}
            />
            <ProgressBar
              label="Margem média"
              actual={overview.meta.marginActual}
              target={overview.meta.marginTarget}
              format={(v) => `${v}%`}
            />
          </section>
        )}

        {/* TOGGLE SKUs / CAMPANHAS */}
        {overview && (
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => { setViewMode("skus"); resetFilters(); if (selectedCampaign) switchToAccountTimeSeries(); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "skus" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              SKUs
            </button>
            <button
              onClick={() => { setViewMode("campaigns"); resetFilters(); if (selectedCampaign) switchToAccountTimeSeries(); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "campaigns" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Campanhas
            </button>
          </div>
        )}

        {/* FUNIL E-COMMERCE (GA4) */}
        {ga4Data && ga4Data.source === "ga4" && ga4Data.funnel && ga4Data.summary && (() => {
          const funnel = ga4Data.funnel;
          const summary = ga4Data.summary;
          const convRate = ga4Data.overallConversionRate ?? 0;
          const channels = ga4Data.channelAcquisition;
          return (
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold">Funil E-commerce</h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                GA4
              </span>
              <span className="text-[11px] text-zinc-400 ml-auto">
                {dateRange.label}
              </span>
            </div>

            {/* Funil visual */}
            {(() => {
              const funnelColors = [
                "#3b82f6", "#6366f1", "#818cf8", "#8b5cf6", "#a855f7", "#c084fc", "#d946ef", "#e879f9", "#f472b6",
              ];
              const maxCount = funnel[0]?.count || 1;
              return (
              <div className="overflow-x-auto mb-4">
                <div className="flex items-end gap-1 min-w-[700px]">
                  {funnel.map((step, i) => {
                    const heightPct = Math.max(15, (step.count / maxCount) * 100);
                    return (
                      <div key={step.eventName} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-medium text-zinc-600 mb-1 text-center leading-tight h-8 flex items-end justify-center">
                          {step.step}
                        </span>
                        <div
                          className="w-full rounded-md flex items-center justify-center transition-all mx-0.5"
                          style={{
                            height: `${Math.round(heightPct * 1.1)}px`,
                            background: `linear-gradient(180deg, ${funnelColors[i % funnelColors.length]}cc 0%, ${funnelColors[i % funnelColors.length]} 100%)`,
                          }}
                        >
                          <span className="text-white font-bold text-[11px]">
                            {step.count >= 1000
                              ? `${(step.count / 1000).toFixed(1).replace(".", ",")}k`
                              : step.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {i > 0 && step.dropoff > 0 ? (
                          <span className="text-[9px] text-red-500 mt-0.5 font-medium">
                            -{step.dropoff.toFixed(1).replace(".", ",")}%
                          </span>
                        ) : i === 0 ? (
                          <span className="text-[9px] text-zinc-400 mt-0.5">entrada</span>
                        ) : (
                          <span className="text-[9px] text-zinc-300 mt-0.5">&nbsp;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Conversão geral */}
            <div className="text-center mb-4">
              <span className="text-xs text-zinc-500">Conversão geral ({funnel[0]?.step ?? "impressão"} → {funnel[funnel.length - 1]?.step ?? "purchase"}): </span>
              <span className="text-sm font-bold text-purple-700">
                {convRate.toFixed(2).replace(".", ",")}%
              </span>
            </div>

            {/* Resumo GA4 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Sessões</p>
                <p className="text-lg font-bold text-zinc-800">{summary.sessions.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Usuários</p>
                <p className="text-lg font-bold text-zinc-800">{summary.users.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Ticket Médio</p>
                <p className="text-lg font-bold text-zinc-800">{formatBRL(summary.avgOrderValue)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Receita (GA4)</p>
                <p className="text-lg font-bold text-zinc-800">{formatBRL(summary.purchaseRevenue)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Novos Usuários</p>
                <p className="text-lg font-bold text-zinc-800">{summary.newUsers.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Compras</p>
                <p className="text-lg font-bold text-zinc-800">{summary.purchases.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Abandono Carrinho</p>
                <p className="text-lg font-bold text-amber-600">{summary.cartAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-center">
                <p className="text-[11px] text-zinc-500 mb-0.5">Abandono Checkout</p>
                <p className="text-lg font-bold text-amber-600">{summary.checkoutAbandonmentRate.toFixed(1).replace(".", ",")}%</p>
              </div>
            </div>

            {/* Aquisição por Canal */}
            {channels && channels.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">Aquisição de Usuários por Canal</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-[11px] text-zinc-500">
                        <th className="pb-2 font-medium">Canal</th>
                        <th className="pb-2 font-medium text-right">Usuários</th>
                        <th className="pb-2 font-medium text-right">Novos</th>
                        <th className="pb-2 font-medium text-right">Sessões</th>
                        <th className="pb-2 font-medium text-right">Conversões</th>
                        <th className="pb-2 font-medium text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch) => (
                        <tr key={ch.channel} className="border-b border-zinc-100 last:border-0">
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{
                                background: ch.channel === "Organic Search" ? "#10b981"
                                  : ch.channel === "Paid Search" ? "#3b82f6"
                                  : ch.channel === "Direct" ? "#6366f1"
                                  : ch.channel === "Organic Social" ? "#f59e0b"
                                  : ch.channel === "Paid Social" ? "#8b5cf6"
                                  : ch.channel === "Referral" ? "#ec4899"
                                  : ch.channel === "Email" ? "#ef4444"
                                  : "#9ca3af"
                              }} />
                              <span className="text-xs font-medium text-zinc-700">{ch.channel}</span>
                            </span>
                          </td>
                          <td className="py-1.5 text-right text-xs">{ch.users.toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 text-right text-xs">{ch.newUsers.toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 text-right text-xs">{ch.sessions.toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 text-right text-xs">{ch.conversions.toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 text-right text-xs font-medium">{formatBRL(ch.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
          );
        })()}

        {/* RANKING DE SKUs */}
        {overview && viewMode === "skus" && (() => {
          const totalPages = Math.ceil(filteredSkus.length / SKUS_PER_PAGE);
          const pageSkus = filteredSkus.slice(skuPage * SKUS_PER_PAGE, (skuPage + 1) * SKUS_PER_PAGE);
          const startIdx = skuPage * SKUS_PER_PAGE;
          return (
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-semibold">
                Ranking de SKUs
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {filteredSkus.length !== overview.skus.length
                    ? `${filteredSkus.length} de ${overview.skus.length} SKUs`
                    : `${overview.skus.length} SKUs`}
                </span>
              </h2>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setSkuPage((p) => Math.max(0, p - 1))}
                    disabled={skuPage === 0}
                    className="px-2 py-1 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-zinc-500">
                    {skuPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={skuPage >= totalPages - 1}
                    className="px-2 py-1 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próximo
                  </button>
                </div>
              )}
            </div>
            {/* Busca + Filtros SKU */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Buscar SKU ou nome..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSkuPage(0); }}
                className="w-full sm:w-56 px-3 py-1.5 text-sm border rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
              <div className="flex gap-1">
                {[
                  { value: "all", label: "Todos", bg: "bg-zinc-200 text-zinc-700" },
                  { value: "escalar", label: "Escalar", bg: "bg-emerald-100 text-emerald-800" },
                  { value: "manter", label: "Manter", bg: "bg-amber-100 text-amber-800" },
                  { value: "pausar", label: "Pausar", bg: "bg-red-100 text-red-800" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterStatus(opt.value); setSkuPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterStatus === opt.value ? opt.bg : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-zinc-600">
                  <tr>
                    <th className="py-2 pr-2 text-left w-8">#</th>
                    <th className="py-2 pr-2 text-left">SKU</th>
                    <th className="py-2 pr-2 text-left">Nome</th>
                    <SortableHeader label="Receita" field="revenue" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Ads" field="ads" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="ROAS" field="roas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <SortableHeader label="Conv" field="conversions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-14" />
                    <SortableHeader label="CPA" field="cpa" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="CTR" field="ctr" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <th className="py-2 pl-2 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSkus.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-zinc-400 text-sm">
                        {searchQuery || filterStatus !== "all"
                          ? `Nenhum SKU encontrado${searchQuery ? ` para "${searchQuery}"` : ""}. Tente refinar sua busca.`
                          : "Nenhum SKU disponível para o período selecionado."}
                      </td>
                    </tr>
                  )}
                  {pageSkus.map((s, i) => (
                    <tr
                      key={s.sku}
                      className={`border-b cursor-pointer hover:bg-zinc-50 ${s.sku === sku ? "bg-zinc-100" : ""}`}
                      onClick={() => selectSku(s.sku)}
                    >
                      <td className="py-1.5 pr-2 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs">{s.sku}</td>
                      <td className="py-1.5 pr-2 max-w-[200px] truncate" title={s.nome}>{s.nome}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(s.revenue)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(s.ads)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{s.roas > 0 ? s.roas.toFixed(1) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{fmtConv(s.conversions)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{s.conversions > 0 ? formatBRL(s.cpa) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{s.ctr > 0 ? `${s.ctr.toFixed(2)}%` : "—"}</td>
                      <td className="py-1.5 pl-2 text-center">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {overview.shoppingTotals && (
                  <tfoot className="border-t-2 font-semibold text-zinc-700 bg-zinc-50">
                    <tr>
                      <td className="py-2" colSpan={3}>Total Shopping</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(overview.shoppingTotals.revenue)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatBRL(overview.shoppingTotals.ads)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {overview.shoppingTotals.ads > 0
                          ? (overview.shoppingTotals.revenue / overview.shoppingTotals.ads).toFixed(1)
                          : "—"}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {fmtConv(overview.skus.reduce((sum, s) => sum + s.conversions, 0))}
                      </td>
                      <td className="py-2" />
                      <td className="py-2" />
                      <td className="py-2" />
                    </tr>
                    {overview.accountTotals && (
                      <tr className="text-zinc-500">
                        <td className="py-2" colSpan={3}>Total Conta (todas campanhas)</td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatBRL(overview.accountTotals.revenue)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatBRL(overview.accountTotals.ads)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {overview.accountTotals.ads > 0
                            ? (overview.accountTotals.revenue / overview.accountTotals.ads).toFixed(1)
                            : "—"}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {fmtConv(overview.accountTotals.conversions)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {overview.accountTotals.impressions > 0
                            ? `${(overview.accountTotals.clicks / overview.accountTotals.impressions * 100).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="py-2" />
                        <td className="py-2" />
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-3 pt-3 border-t">
                <button
                  onClick={() => setSkuPage((p) => Math.max(0, p - 1))}
                  disabled={skuPage === 0}
                  className="px-3 py-1.5 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-zinc-500 flex items-center">
                  Página {skuPage + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={skuPage >= totalPages - 1}
                  className="px-3 py-1.5 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próximo
                </button>
              </div>
            )}
          </section>
          );
        })()}

        {/* TABELA DE CAMPANHAS */}
        {campaigns && viewMode === "campaigns" && (() => {
          const totalPages = Math.ceil(filteredCampaigns.length / SKUS_PER_PAGE);
          const pageCamps = filteredCampaigns.slice(skuPage * SKUS_PER_PAGE, (skuPage + 1) * SKUS_PER_PAGE);
          const startIdx = skuPage * SKUS_PER_PAGE;
          const totals = filteredCampaigns.reduce((acc, c) => ({
            costBRL: acc.costBRL + c.costBRL,
            impressions: acc.impressions + c.impressions,
            clicks: acc.clicks + c.clicks,
            conversions: acc.conversions + c.conversions,
            revenue: acc.revenue + c.revenue,
          }), { costBRL: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
          // Tipos de canal únicos presentes nos dados
          const channelTypes = [...new Set(campaigns.campaigns.map((c) => c.channelType))];
          return (
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-semibold">
                Campanhas
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {filteredCampaigns.length !== campaigns.campaigns.length
                    ? `${filteredCampaigns.length} de ${campaigns.campaigns.length} campanhas`
                    : `${campaigns.campaigns.length} campanhas`}
                </span>
                {selectedCampaign && (
                  <button
                    onClick={switchToAccountTimeSeries}
                    className="ml-3 text-xs font-normal text-blue-600 hover:text-blue-800"
                  >
                    Ver total da conta
                  </button>
                )}
              </h2>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setSkuPage((p) => Math.max(0, p - 1))}
                    disabled={skuPage === 0}
                    className="px-2 py-1 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-zinc-500">{skuPage + 1} / {totalPages}</span>
                  <button
                    onClick={() => setSkuPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={skuPage >= totalPages - 1}
                    className="px-2 py-1 rounded border text-xs hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próximo
                  </button>
                </div>
              )}
            </div>
            {/* Busca + Filtros Campanhas */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Buscar campanha..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSkuPage(0); }}
                className="w-full sm:w-56 px-3 py-1.5 text-sm border rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => { setFilterChannel("all"); setSkuPage(0); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterChannel === "all" ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Todos
                </button>
                {channelTypes.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => { setFilterChannel(ct); setSkuPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterChannel === ct
                        ? (channelColors[ct] ?? "bg-zinc-200 text-zinc-700")
                        : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    {channelLabels[ct] ?? ct}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[
                  { value: "all", label: "Todas" },
                  { value: "ENABLED", label: "Ativas" },
                  { value: "PAUSED", label: "Pausadas" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterCampStatus(opt.value); setSkuPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterCampStatus === opt.value ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-zinc-600">
                  <tr>
                    <th className="py-2 pr-2 text-left w-8">#</th>
                    <th className="py-2 pr-2 text-left">Campanha</th>
                    <th className="py-2 px-2 text-center w-20">Tipo</th>
                    <th className="py-2 px-2 text-center w-16">Status</th>
                    <SortableHeader label="Gasto" field="costBRL" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Conv" field="conversions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-14" />
                    <SortableHeader label="Receita" field="revenue" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="CPA" field="cpa" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="ROAS" field="roas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right w-16" />
                    <SortableHeader label="Impr." field="impressions" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortableHeader label="Cliques" field="clicks" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {pageCamps.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-zinc-400 text-sm">
                        {searchQuery || filterChannel !== "all" || filterCampStatus !== "all"
                          ? `Nenhuma campanha encontrada${searchQuery ? ` para "${searchQuery}"` : ""}. Tente refinar seus filtros.`
                          : "Nenhuma campanha disponível para o período selecionado."}
                      </td>
                    </tr>
                  )}
                  {pageCamps.map((c, i) => (
                    <tr
                      key={c.campaignId}
                      className={`border-b cursor-pointer hover:bg-zinc-50 ${c.campaignId === selectedCampaign ? "bg-zinc-100" : ""}`}
                      onClick={() => selectCampaign(c.campaignId)}
                    >
                      <td className="py-1.5 pr-2 text-zinc-400 text-xs">{startIdx + i + 1}</td>
                      <td className="py-1.5 pr-2 max-w-[220px] truncate" title={c.campaignName}>{c.campaignName}</td>
                      <td className="py-1.5 px-2 text-center"><ChannelBadge type={c.channelType} /></td>
                      <td className="py-1.5 px-2 text-center"><CampaignStatusBadge status={c.status} /></td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(c.costBRL)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{fmtConv(c.conversions)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(c.revenue)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{c.conversions > 0 ? formatBRL(c.cpa) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{c.roas > 0 ? c.roas.toFixed(1) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{c.impressions.toLocaleString("pt-BR")}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{c.clicks.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 font-semibold text-zinc-700 bg-zinc-50">
                  <tr>
                    <td className="py-2" colSpan={4}>Total</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(totals.costBRL)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtConv(totals.conversions)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(totals.revenue)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {totals.conversions > 0 ? formatBRL(totals.costBRL / totals.conversions) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {totals.costBRL > 0 ? (totals.revenue / totals.costBRL).toFixed(1) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{totals.impressions.toLocaleString("pt-BR")}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{totals.clicks.toLocaleString("pt-BR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          );
        })()}

        {/* GRÁFICOS DE TENDÊNCIA */}
        {timeseries && timeseries.series.length > 1 && (
          <ChartsSection data={timeseries} ga4Data={ga4Data} />
        )}

        {/* KPIs — linha 1: métricas de decisão (apenas no modo SKU) */}
        {data && viewMode === "skus" && (
          <section>
            <h2 className="font-semibold mb-3">
              KPIs — {data.skuTitle || data.sku}
              {data.source === "google-ads" && <span className="ml-2 text-xs font-normal text-emerald-600">Google Ads (Shopping)</span>}
              {data.source === "mock" && <span className="ml-2 text-xs font-normal text-zinc-400">Mock</span>}
            </h2>
            <div className="grid gap-4 md:grid-cols-4">
              <Kpi title="ROAS" value={data.cards.roas.toFixed(2)} subtitle="Meta: 7,0 • Pausa: < 5,0" status={roasStatus(data.cards.roas)} />
              <Kpi title="CPA" value={data.cards.cpa > 0 ? formatBRL(data.cards.cpa) : "—"} subtitle="Limite: R$80 • Meta: < R$60" status={cpaStatus(data.cards.cpa)} />
              <Kpi title="Margem" value={`${data.cards.marginPct}%`} subtitle="Meta: ≥ 25%" status={marginStatus(data.cards.marginPct)} />
              <Kpi title="Após Ads" value={formatBRL(data.cards.profitAfterAds)} subtitle="Lucro real" status={data.cards.profitAfterAds < 0 ? "danger" : "ok"} />
            </div>
          </section>
        )}

        {/* KPIs — linha 2 */}
        {data && viewMode === "skus" && (
          <section className="grid gap-4 md:grid-cols-4">
            <Kpi title="Receita" value={formatBRL(data.cards.revenue)} subtitle="Faturamento bruto" />
            <Kpi title="Gasto Ads" value={formatBRL(data.cards.ads)} subtitle="Investimento Shopping" />
            <Kpi title="Valor Médio/Pedido" value={formatBRL(data.cards.arpur)} subtitle="Receita ÷ conversões" />
            <Kpi title="Taxa de Conversão" value={formatPct(data.cards.convRate)} subtitle="Conversões ÷ cliques" />
          </section>
        )}

        {/* KPIs — linha 3: tráfego e lucro */}
        {data && viewMode === "skus" && (
          <section className="grid gap-4 md:grid-cols-4">
            <Kpi title="CPC" value={formatBRL(data.cards.cpc)} subtitle="Custo por clique" />
            <Kpi title="CPM" value={formatBRL(data.cards.cpm)} subtitle="Custo por mil impressões" />
            <Kpi title="ARPUR" value={data.cards.arpur > 0 ? formatBRL(data.cards.arpur) : "—"} subtitle="Receita média por compra" />
            <Kpi title="Lucro Bruto" value={formatBRL(data.cards.grossProfit)} subtitle="Receita × margem" />
          </section>
        )}

        {/* ALERTAS */}
        {data && viewMode === "skus" && data.alerts.length > 0 && (
          <section className="space-y-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.title}
                className={`rounded-xl border p-4 ${alertColors[alert.severity]}`}
              >
                <p className="font-semibold">{alert.title}</p>
                <p className="text-sm opacity-80">{alert.description}</p>
              </div>
            ))}
          </section>
        )}

        {/* FUNIL */}
        {data && viewMode === "skus" && (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold mb-4">
              Funil — {data.skuTitle || data.sku}
              {data.source === "google-ads" && <span className="ml-2 text-xs font-normal text-emerald-600">Google Ads</span>}
              {data.source === "mock" && <span className="ml-2 text-xs font-normal text-zinc-400">Mock</span>}
            </h2>

            <table className="w-full text-sm">
              <thead className="border-b text-zinc-600">
                <tr>
                  <th className="py-2 text-left">Etapa</th>
                  <th className="py-2">Qtd</th>
                  <th className="py-2">Taxa</th>
                  <th className="py-2">Ads</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((row) => (
                  <tr key={row.etapa} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.etapa}</td>
                    <td className="py-2">{row.qtd.toLocaleString("pt-BR")}</td>
                    <td className="py-2">{formatPct(row.taxa)}</td>
                    <td className="py-2">
                      {row.custo ? formatBRL(row.custo) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <span>Casanova Analytics</span>
          <span>
            {data
              ? `Fonte: ${data.source === "google-ads" ? "Google Ads" : "Dados mock"} • Atualizado às ${new Date(data.updatedAt).toLocaleTimeString("pt-BR")}`
              : "Aguardando dados..."}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* =========================
   DateRangePicker (estilo Google Ads)
========================= */
function DateRangePicker(props: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(props.value.preset ?? null);
  const ref = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const presets = getPresets();

  function selectPreset(p: typeof presets[number]) {
    const { start, end } = p.range();
    setSelStart(fmtDate(start));
    setSelEnd(fmtDate(end));
    setActivePreset(p.preset);
  }

  function applySelection() {
    if (!selStart || !selEnd) return;
    const s = selStart <= selEnd ? selStart : selEnd;
    const e = selStart <= selEnd ? selEnd : selStart;
    const preset = presets.find((p) => p.preset === activePreset);
    props.onChange({
      startDate: s,
      endDate: e,
      label: preset?.label ?? `${fmtDateBR(new Date(s + "T12:00:00"))} — ${fmtDateBR(new Date(e + "T12:00:00"))}`,
      preset: activePreset ?? undefined,
    });
    setOpen(false);
  }

  function handleDayClick(day: string) {
    setActivePreset(null);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(day);
      setSelEnd(null);
    } else {
      setSelEnd(day);
    }
  }

  function prevMonth() {
    setCalMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }

  function nextMonth() {
    setCalMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }

  // Segundo mês do calendário
  const month2 = calMonth.month + 1 > 11
    ? { year: calMonth.year + 1, month: 0 }
    : { year: calMonth.year, month: calMonth.month + 1 };

  const effectiveStart = selStart && selEnd
    ? (selStart <= selEnd ? selStart : selEnd)
    : selStart ?? "";
  const effectiveEnd = selStart && selEnd
    ? (selStart <= selEnd ? selEnd : selStart)
    : selStart ?? "";

  return (
    <div className="relative" ref={ref}>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-zinc-600">Período</p>
        <button
          onClick={() => {
            if (!open) {
              // Sync selection state com valor atual
              setSelStart(props.value.startDate);
              setSelEnd(props.value.endDate);
              setActivePreset(props.value.preset ?? null);
              // Posicionar calendário no mês do startDate
              const d = new Date(props.value.startDate + "T12:00:00");
              setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
            }
            setOpen(!open);
          }}
          disabled={props.loading}
          className="mt-2 w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {props.value.label}
          </span>
          <svg className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* DROPDOWN */}
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 rounded-xl border bg-white shadow-xl flex flex-col sm:flex-row" style={{ width: "680px", maxWidth: "calc(100vw - 2rem)" }}>
          {/* PRESETS */}
          <div className="sm:w-44 border-b sm:border-b-0 sm:border-r py-2 shrink-0 flex sm:flex-col flex-wrap gap-0">
            {presets.map((p) => (
              <button
                key={p.preset}
                onClick={() => selectPreset(p)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                  activePreset === p.preset ? "bg-blue-50 text-blue-700 font-medium" : "text-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="border-t my-1" />
            <button
              onClick={() => {
                setActivePreset(null);
                setSelStart(null);
                setSelEnd(null);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                activePreset === null && selStart === null ? "bg-blue-50 text-blue-700 font-medium" : "text-zinc-700"
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* CALENDÁRIOS */}
          <div className="flex-1 min-w-0 p-4 overflow-auto">
            {/* Navegação */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 hover:bg-zinc-100 rounded">
                <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex gap-8 text-sm font-medium">
                <span>{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                <span>{MONTH_NAMES[month2.month]} {month2.year}</span>
              </div>
              <button onClick={nextMonth} className="p-1 hover:bg-zinc-100 rounded">
                <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Dois meses lado a lado */}
            <div className="flex flex-wrap gap-6">
              <CalendarMonth
                year={calMonth.year}
                month={calMonth.month}
                rangeStart={effectiveStart}
                rangeEnd={effectiveEnd}
                onDayClick={handleDayClick}
              />
              <CalendarMonth
                year={month2.year}
                month={month2.month}
                rangeStart={effectiveStart}
                rangeEnd={effectiveEnd}
                onDayClick={handleDayClick}
              />
            </div>

            {/* Inputs de data + Aplicar */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t">
              <input
                type="date"
                value={effectiveStart}
                onChange={(e) => {
                  setSelStart(e.target.value);
                  setActivePreset(null);
                }}
                className="rounded border px-2 py-1 text-sm flex-1"
              />
              <span className="text-zinc-400">—</span>
              <input
                type="date"
                value={effectiveEnd}
                onChange={(e) => {
                  setSelEnd(e.target.value);
                  setActivePreset(null);
                }}
                className="rounded border px-2 py-1 text-sm flex-1"
              />
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={applySelection}
                disabled={!selStart || !selEnd}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Mês do Calendário
========================= */
function CalendarMonth(props: {
  year: number;
  month: number;
  rangeStart: string;
  rangeEnd: string;
  onDayClick: (day: string) => void;
}) {
  const daysInMonth = getDaysInMonth(props.year, props.month);
  const firstDay = getFirstDayOfMonth(props.year, props.month);
  const today = fmtDate(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex-1 min-w-[200px]">
      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 text-center text-xs text-zinc-400 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      {/* Dias */}
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;

          const dateStr = `${props.year}-${String(props.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isStart = isSameDay(dateStr, props.rangeStart);
          const isEnd = isSameDay(dateStr, props.rangeEnd);
          const inRange = props.rangeStart && props.rangeEnd && isInRange(dateStr, props.rangeStart, props.rangeEnd);
          const isToday = isSameDay(dateStr, today);
          const isFuture = dateStr > today;

          let cls = "py-1 cursor-pointer transition-colors ";
          if (isStart || isEnd) {
            cls += "bg-blue-600 text-white rounded-full font-medium ";
          } else if (inRange) {
            cls += "bg-blue-50 text-blue-800 ";
          } else if (isFuture) {
            cls += "text-zinc-300 ";
          } else {
            cls += "hover:bg-zinc-100 rounded-full ";
          }
          if (isToday && !isStart && !isEnd) {
            cls += "font-bold text-blue-600 ";
          }

          return (
            <div
              key={dateStr}
              className={cls}
              onClick={() => !isFuture && props.onDayClick(dateStr)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   Comparativo Trimestre vs Semestre
========================= */

type PeriodSummary = {
  revenue: number;
  ads: number;
  roas: number;
  conversions: number;
  clicks: number;
  impressions: number;
};

function QuarterVsSemester() {
  const [q, setQ] = useState<PeriodSummary | null>(null);
  const [s, setS] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const endDate = fmtDate(today);

    const q90Start = new Date(today);
    q90Start.setDate(q90Start.getDate() - 89);
    const q180Start = new Date(today);
    q180Start.setDate(q180Start.getDate() - 179);

    const fetchPeriod = async (start: string, end: string): Promise<PeriodSummary> => {
      const res = await fetch(`/api/overview?period=custom&startDate=${start}&endDate=${end}`);
      const json = await res.json();
      const totals = json.accountTotals ?? {
        ads: json.skus?.reduce((a: number, sk: { ads: number }) => a + sk.ads, 0) ?? 0,
        revenue: json.meta?.revenueActual ?? 0,
        conversions: json.skus?.reduce((a: number, sk: { conversions: number }) => a + sk.conversions, 0) ?? 0,
        impressions: 0,
        clicks: 0,
      };
      const roas = totals.ads > 0 ? Math.round((totals.revenue / totals.ads) * 100) / 100 : 0;
      return {
        revenue: totals.revenue,
        ads: totals.ads,
        roas,
        conversions: totals.conversions,
        clicks: totals.clicks ?? 0,
        impressions: totals.impressions ?? 0,
      };
    };

    Promise.all([
      fetchPeriod(fmtDate(q90Start), endDate),
      fetchPeriod(fmtDate(q180Start), endDate),
    ])
      .then(([quarter, semester]) => {
        if (!cancelled) {
          setQ(quarter);
          setS(semester);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72 text-zinc-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-2 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando comparativo...
      </div>
    );
  }

  if (!q || !s) {
    return <div className="flex items-center justify-center h-72 text-zinc-400 text-sm">Dados indisponíveis.</div>;
  }

  const metrics: { label: string; qVal: string; sVal: string; deltaPct: number }[] = [
    { label: "Receita", qVal: formatBRL(q.revenue), sVal: formatBRL(s.revenue), deltaPct: s.revenue > 0 ? Math.round(((q.revenue / (s.revenue / 2)) - 1) * 100) : 0 },
    { label: "Gasto Ads", qVal: formatBRL(q.ads), sVal: formatBRL(s.ads), deltaPct: s.ads > 0 ? Math.round(((q.ads / (s.ads / 2)) - 1) * 100) : 0 },
    { label: "ROAS", qVal: q.roas.toFixed(2), sVal: s.roas.toFixed(2), deltaPct: s.roas > 0 ? Math.round(((q.roas / s.roas) - 1) * 100) : 0 },
    { label: "Conversões", qVal: fmtConv(q.conversions), sVal: fmtConv(s.conversions), deltaPct: s.conversions > 0 ? Math.round(((q.conversions / (s.conversions / 2)) - 1) * 100) : 0 },
    { label: "CTR", qVal: q.impressions > 0 ? `${(q.clicks / q.impressions * 100).toFixed(2)}%` : "—", sVal: s.impressions > 0 ? `${(s.clicks / s.impressions * 100).toFixed(2)}%` : "—", deltaPct: 0 },
  ];

  // Recalcular delta do CTR separadamente
  const qCtr = q.impressions > 0 ? q.clicks / q.impressions * 100 : 0;
  const sCtr = s.impressions > 0 ? s.clicks / s.impressions * 100 : 0;
  metrics[4].deltaPct = sCtr > 0 ? Math.round(((qCtr / sCtr) - 1) * 100) : 0;

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-4">Comparativo proporcional: valores do trimestre vs metade do semestre (mesma base temporal)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {metrics.map((m) => {
          const isPositive = m.deltaPct > 0;
          const isNegative = m.deltaPct < 0;
          const isNeutral = m.deltaPct === 0;
          // Para "Gasto Ads", subir é ruim e descer é bom
          const invertColor = m.label === "Gasto Ads";
          const deltaColor = isNeutral
            ? "text-zinc-400 bg-zinc-100"
            : (isPositive && !invertColor) || (isNegative && invertColor)
              ? "text-emerald-700 bg-emerald-50"
              : "text-red-700 bg-red-50";

          return (
            <div key={m.label} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
              {/* Titulo + Delta */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{m.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${deltaColor}`}>
                  {isPositive ? "+" : ""}{m.deltaPct}%
                </span>
              </div>

              {/* Trimestre */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Trimestre (90d)</p>
                  <p className="text-base font-bold text-zinc-900">{m.qVal}</p>
                </div>
              </div>

              {/* Semestre */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Semestre (180d)</p>
                  <p className="text-base font-semibold text-zinc-500">{m.sVal}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   Seção de Gráficos
========================= */
type ChartTab = "receita" | "roas" | "conversoes" | "trafego" | "cpmclicks" | "trimestre" | "funilga4";

const chartTabs: { key: ChartTab; label: string }[] = [
  { key: "receita", label: "Receita vs Gasto" },
  { key: "roas", label: "ROAS" },
  { key: "conversoes", label: "Conversões" },
  { key: "trafego", label: "Tráfego" },
  { key: "cpmclicks", label: "CPM vs Cliques" },
  { key: "trimestre", label: "Tri vs Sem" },
  { key: "funilga4", label: "Funil GA4" },
];

function ChartsSection({ data, ga4Data }: { data: TimeSeriesResponse; ga4Data?: GA4DataResponse | null }) {
  const [tab, setTab] = useState<ChartTab>("receita");

  // Formatar datas para exibição (dd/mm)
  const chartData = data.series.map((p) => ({
    ...p,
    label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
    cpm: p.impressions > 0 ? Math.round((p.cost / p.impressions) * 1000 * 100) / 100 : 0,
  }));

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Tendências</h2>
        <div className="flex gap-1">
          {chartTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                tab === t.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "trimestre" ? (
        <QuarterVsSemester />
      ) : tab === "funilga4" ? (
        ga4Data && ga4Data.source === "ga4" && ga4Data.dailySeries && ga4Data.dailySeries.length > 1 ? (
          <GA4FunnelChart data={ga4Data.dailySeries} />
        ) : (
          <p className="text-sm text-zinc-400 text-center py-12">
            {ga4Data?.source === "not_configured"
              ? "GA4 não configurado. Configure as credenciais GA4 no .env.local para ver os dados do funil."
              : "Sem dados GA4 para o período selecionado."}
          </p>
        )
      ) : (
        <div className="h-72">
          {tab === "receita" && <RevenueChart data={chartData} />}
          {tab === "roas" && <RoasChart data={chartData} />}
          {tab === "conversoes" && <ConversionsChart data={chartData} />}
          {tab === "trafego" && <TrafficChart data={chartData} />}
          {tab === "cpmclicks" && <CpmClicksChart data={chartData} />}
        </div>
      )}
    </section>
  );
}

type ChartPoint = TimeSeriesPoint & { label: string; cpm: number };

function RevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            name === "revenue" ? "Receita" : "Gasto Ads",
          ]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => (value === "revenue" ? "Receita" : "Gasto Ads")} />
        <Area
          type="monotone"
          dataKey="revenue"
          fill="#d1fae5"
          stroke="#10b981"
          strokeWidth={2}
          fillOpacity={0.4}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function RoasChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [Number(value ?? 0).toFixed(2), "ROAS"]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        {/* Linha de meta ROAS 7 */}
        <Line
          type="monotone"
          dataKey={() => 7}
          stroke="#d4d4d8"
          strokeDasharray="5 5"
          strokeWidth={1}
          dot={false}
          name="Meta (7,0)"
        />
        {/* Linha de pausa ROAS 5 */}
        <Line
          type="monotone"
          dataKey={() => 5}
          stroke="#fca5a5"
          strokeDasharray="3 3"
          strokeWidth={1}
          dot={false}
          name="Pausa (5,0)"
        />
        <Line
          type="monotone"
          dataKey="roas"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#3b82f6" }}
          name="ROAS"
        />
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ConversionsChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            Number(value ?? 0).toLocaleString("pt-BR"),
            name === "conversions" ? "Conversões" : "CPC (R$)",
          ]}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => (value === "conversions" ? "Conversões" : "CPC (R$)")} />
        <Bar dataKey="conversions" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="cpc"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          yAxisId={0}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TrafficChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const v = Number(value ?? 0);
            if (name === "ctr") return [`${v.toFixed(2)}%`, "CTR"];
            return [v.toLocaleString("pt-BR"), name === "impressions" ? "Impressões" : "Cliques"];
          }}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => {
          if (value === "impressions") return "Impressões";
          if (value === "clicks") return "Cliques";
          return "CTR (%)";
        }} />
        <Area
          type="monotone"
          dataKey="impressions"
          fill="#e0f2fe"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          fillOpacity={0.3}
          yAxisId="left"
        />
        <Bar dataKey="clicks" fill="#6366f1" radius={[2, 2, 0, 0]} yAxisId="left" />
        <Line
          type="monotone"
          dataKey="ctr"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={false}
          yAxisId="right"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CpmClicksChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `R$${v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const v = Number(value ?? 0);
            if (name === "cpm") return [`R$ ${v.toFixed(2)}`, "CPM"];
            return [v.toLocaleString("pt-BR"), "Cliques"];
          }}
          labelFormatter={(label: unknown) => `Dia ${label}`}
        />
        <Legend formatter={(value: unknown) => {
          if (value === "cpm") return "CPM (R$)";
          return "Cliques";
        }} />
        <Line
          type="monotone"
          dataKey="cpm"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          yAxisId="left"
        />
        <Bar dataKey="clicks" fill="#6366f1" radius={[2, 2, 0, 0]} yAxisId="right" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function GA4FunnelChart({ data }: { data: GA4DailyPoint[] }) {
  const chartData = data.map((p) => ({
    ...p,
    label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
    revenueK: Math.round(p.purchaseRevenue / 1000 * 100) / 100,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `R$${v}k`}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = Number(value ?? 0);
              if (name === "revenueK") return [`R$ ${(v * 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, "Receita"];
              const labels: Record<string, string> = {
                sessions: "Sessões",
                pageViews: "Page Views",
                viewItems: "View Content",
                addToCarts: "Add to Cart",
                checkouts: "Initiate Checkout",
                shippingInfos: "Shipping Info",
                paymentInfos: "Payment Info",
                purchases: "Purchase",
              };
              return [v.toLocaleString("pt-BR"), labels[name as string] ?? name];
            }}
            labelFormatter={(label: unknown) => `Dia ${label}`}
          />
          <Legend formatter={(value: unknown) => {
            const labels: Record<string, string> = {
              sessions: "Sessões",
              pageViews: "Page Views",
              viewItems: "View Content",
              addToCarts: "Add to Cart",
              checkouts: "Checkout",
              shippingInfos: "Shipping",
              paymentInfos: "Payment",
              purchases: "Purchase",
              revenueK: "Receita (R$k)",
            };
            return labels[value as string] ?? value;
          }} />
          <Area type="monotone" dataKey="sessions" fill="#e0e7ff" stroke="#818cf8" strokeWidth={1.5} fillOpacity={0.3} yAxisId="left" />
          <Line type="monotone" dataKey="pageViews" stroke="#3b82f6" strokeWidth={1.5} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="viewItems" stroke="#6366f1" strokeWidth={1.5} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="addToCarts" stroke="#a855f7" strokeWidth={2} dot={false} yAxisId="left" />
          <Line type="monotone" dataKey="checkouts" stroke="#f59e0b" strokeWidth={2} dot={false} yAxisId="left" />
          <Bar dataKey="purchases" fill="#10b981" radius={[2, 2, 0, 0]} yAxisId="left" />
          <Line type="monotone" dataKey="revenueK" stroke="#ef4444" strokeWidth={2} dot={false} yAxisId="right" strokeDasharray="5 5" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =========================
   Componente KPI
========================= */
function Kpi(props: { title: string; value: string; subtitle: string; status?: KpiStatus }) {
  const borderClass =
    props.status === "ok" ? "border-emerald-300" :
    props.status === "warn" ? "border-amber-300" :
    props.status === "danger" ? "border-red-300" :
    "";
  return (
    <div className={`rounded-xl border bg-white p-4 ${borderClass}`}>
      <p className="text-sm text-zinc-600">{props.title}</p>
      <p className="mt-2 text-2xl font-semibold">{props.value}</p>
      <p className="mt-1 text-xs text-zinc-500">{props.subtitle}</p>
    </div>
  );
}

/* =========================
   Barra de Progresso
========================= */
function ProgressBar(props: {
  label: string;
  actual: number;
  target: number;
  format: (v: number) => string;
}) {
  const pct = Math.min((props.actual / props.target) * 100, 100);
  const color =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 80 ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-600 mb-1">
        <span>{props.label}</span>
        <span>
          {props.format(props.actual)} / {props.format(props.target)}{" "}
          <span className="text-zinc-400">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* =========================
   Badge de Status
========================= */
function StatusBadge(props: { status: "escalar" | "manter" | "pausar" }) {
  const cfg = {
    escalar: { bg: "bg-emerald-100 text-emerald-800", label: "Escalar" },
    manter: { bg: "bg-amber-100 text-amber-800", label: "Manter" },
    pausar: { bg: "bg-red-100 text-red-800", label: "Pausar" },
  } as const;
  const { bg, label } = cfg[props.status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}

/* =========================
   Badges de Campanha
========================= */
const channelColors: Record<string, string> = {
  SHOPPING: "bg-emerald-100 text-emerald-800",
  PERFORMANCE_MAX: "bg-blue-100 text-blue-800",
  SEARCH: "bg-purple-100 text-purple-800",
  DISPLAY: "bg-orange-100 text-orange-800",
  VIDEO: "bg-red-100 text-red-800",
  DISCOVERY: "bg-cyan-100 text-cyan-800",
};

const channelLabels: Record<string, string> = {
  SHOPPING: "Shopping",
  PERFORMANCE_MAX: "PMax",
  SEARCH: "Search",
  DISPLAY: "Display",
  VIDEO: "Video",
  DISCOVERY: "Discovery",
};

function ChannelBadge({ type }: { type: string }) {
  const bg = channelColors[type] ?? "bg-zinc-100 text-zinc-800";
  const label = channelLabels[type] ?? type;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "ENABLED") {
    return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Ativa" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" title="Pausada" />;
}

function SortableHeader({ label, field, current, dir, onSort, className }: {
  label: string;
  field: string;
  current: string;
  dir: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <th
      className={`py-2 px-2 cursor-pointer select-none hover:text-zinc-900 ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className="text-[10px]">
          {isActive ? (dir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
      </span>
    </th>
  );
}
