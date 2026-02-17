"use client";

import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "@/types/api";
import type { SmartAlert, SmartAlertsResponse } from "@/lib/alert-types";
import { defaultRange, smartAlertStyles, categoryLabels } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import DateRangePicker from "@/components/ui/date-range-picker";
import { AlertTriangle, TrendingDown, TrendingUp, ShieldAlert, Filter, Search } from "lucide-react";

type SeverityFilter = "all" | "danger" | "warn" | "info" | "success";
type CategoryFilter = "all" | "account" | "campaign" | "sku" | "trend";

const SEVERITY_OPTIONS: { key: SeverityFilter; label: string; color: string }[] = [
  { key: "all", label: "Todos", color: "bg-zinc-100 text-zinc-700" },
  { key: "danger", label: "Críticos", color: "bg-red-100 text-red-700" },
  { key: "warn", label: "Avisos", color: "bg-amber-100 text-amber-700" },
  { key: "success", label: "Positivos", color: "bg-emerald-100 text-emerald-700" },
  { key: "info", label: "Info", color: "bg-blue-100 text-blue-700" },
];

const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "account", label: "Conta" },
  { key: "campaign", label: "Campanha" },
  { key: "sku", label: "SKU" },
  { key: "trend", label: "Tendência" },
];

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const isPositive = delta > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-emerald-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}%
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  const styles = smartAlertStyles[severity];
  if (!styles) return null;
  return (
    <span className={`text-sm ${styles.text}`}>{styles.icon}</span>
  );
}

export default function AlertsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SmartAlertsResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadAlerts = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", range.preset ?? "custom");
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);

      const res = await fetch(`/api/alerts?${params.toString()}`);
      if (res.ok) {
        const json: SmartAlertsResponse = await res.json();
        setData(json);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadAlerts(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDateRange(range: DateRange) {
    setDateRange(range);
    setDismissed(new Set());
    loadAlerts(range);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  // Filter alerts
  const allAlerts = data?.alerts ?? [];
  const filtered = allAlerts.filter((a) => {
    if (dismissed.has(a.id)) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.entityName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const dismissedCount = dismissed.size;
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-zinc-600" />
            Alertas
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Monitoramento inteligente de desempenho — comparação com período anterior
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={applyDateRange} loading={loading} />
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">{summary.total}</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">alertas detectados</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-medium text-red-400 uppercase tracking-wide">Críticos</p>
            <p className="text-2xl font-bold text-red-700 mt-0.5">{summary.danger}</p>
            <p className="text-[10px] text-red-400 mt-0.5">ação imediata</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wide">Avisos</p>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{summary.warn}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">monitorar</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">Positivos</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{summary.success}</p>
            <p className="text-[10px] text-emerald-400 mt-0.5">bom desempenho</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">Info</p>
            <p className="text-2xl font-bold text-blue-700 mt-0.5">{summary.info}</p>
            <p className="text-[10px] text-blue-400 mt-0.5">informativo</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar alerta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-zinc-400 mr-1" />
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSeverityFilter(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                severityFilter === opt.key ? opt.color : "bg-zinc-50 text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCategoryFilter(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === opt.key
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-zinc-50 text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period info */}
      {data && (
        <div className="text-xs text-zinc-400">
          Período: {data.currentPeriod.start} a {data.currentPeriod.end}
          {" · "}Comparado com: {data.previousPeriod.start} a {data.previousPeriod.end}
          {dismissedCount > 0 && (
            <span className="ml-2">
              · {dismissedCount} alerta{dismissedCount > 1 ? "s" : ""} dispensado{dismissedCount > 1 ? "s" : ""}
              <button
                onClick={() => setDismissed(new Set())}
                className="ml-1 text-indigo-500 hover:text-indigo-700 underline"
              >
                restaurar
              </button>
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 animate-pulse">
              <div className="h-4 w-2/3 bg-zinc-200 rounded" />
              <div className="h-3 w-1/2 bg-zinc-100 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Alert list */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">
            {allAlerts.length === 0 ? "Nenhum alerta detectado no período" : "Nenhum alerta corresponde aos filtros"}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onDismiss={() => dismiss(alert.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   Alert Card Component
========================= */

function AlertCard({ alert, onDismiss }: { alert: SmartAlert; onDismiss: () => void }) {
  const styles = smartAlertStyles[alert.severity];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 transition-all hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityIcon severity={alert.severity} />
            <h3 className={`text-sm font-semibold ${styles.text}`}>{alert.title}</h3>
            <DeltaBadge delta={alert.deltaPct} />
          </div>

          {/* Description */}
          <p className="text-xs text-zinc-600 mt-1">{alert.description}</p>

          {/* Metrics row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/60 text-zinc-500">
              {categoryLabels[alert.category] ?? alert.category}
            </span>
            {alert.entityName && (
              <span className="text-[10px] text-zinc-500">
                {alert.entityName}
              </span>
            )}
            <span className="text-[10px] text-zinc-400">
              {alert.metric}: {formatMetric(alert.metric, alert.currentValue)}
              {alert.previousValue > 0 && ` (ant: ${formatMetric(alert.metric, alert.previousValue)})`}
            </span>
          </div>

          {/* Recommendation */}
          {alert.recommendation && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-white/50 border border-white/80">
              <p className="text-xs text-zinc-600">
                <span className="font-medium text-zinc-700">Recomendação: </span>
                {alert.recommendation}
              </p>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded hover:bg-white/50 transition-colors"
          title="Dispensar alerta"
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}

function formatMetric(metric: string, value: number): string {
  if (metric === "ROAS") return value.toFixed(1);
  if (metric === "CPA" || metric === "spend" || metric === "revenue") return formatBRL(value);
  if (metric === "conversion_rate") return `${value.toFixed(1)}%`;
  if (metric === "conversions") return value.toLocaleString("pt-BR");
  return value.toFixed(1);
}
