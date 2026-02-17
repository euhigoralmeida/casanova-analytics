"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { YearSelector } from "@/components/planning/year-selector";
import { AnnualPlanningTable } from "@/components/planning/annual-planning-table";
import { TargetPlanningTable } from "@/components/planning/target-planning-table";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import type { PlanningYearData } from "@/types/api";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SyncStatus = "idle" | "syncing" | "synced" | "error";
type SourcesMap = Record<number, Record<string, string>>;
type ActiveTab = "target" | "actual";

export default function PlanningPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<ActiveTab>("target");

  // Actual (existing) data
  const [actualData, setActualData] = useState<PlanningYearData>({});
  const [actualSources, setActualSources] = useState<SourcesMap>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [actualLoading, setActualLoading] = useState(false);
  const [actualDirty, setActualDirty] = useState(false);
  const actualPending = useRef<{ metric: string; month: number; value: number | null }[]>([]);

  // Target (new) data
  const [targetData, setTargetData] = useState<PlanningYearData>({});
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetDirty, setTargetDirty] = useState(false);
  const targetPending = useRef<{ metric: string; month: number; value: number | null }[]>([]);

  // Shared state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncedCount, setSyncedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Derived
  const isActual = activeTab === "actual";
  const dirty = isActual ? actualDirty : targetDirty;
  const loading = isActual ? actualLoading : targetLoading;

  // Load actual data
  useEffect(() => {
    let cancelled = false;
    setActualLoading(true);
    setActualDirty(false);
    actualPending.current = [];

    setLoadError(null);
    fetch(`/api/planning?year=${year}&planType=actual`)
      .then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar dados");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setActualData(json.entries ?? {});
          setActualSources(json.sources ?? {});
          setLastSyncedAt(json.lastSyncedAt ?? null);
          setActualLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActualLoading(false);
          setLoadError("Não foi possível carregar os dados de planejamento.");
        }
      });

    return () => { cancelled = true; };
  }, [year]);

  // Load target data
  useEffect(() => {
    let cancelled = false;
    setTargetLoading(true);
    setTargetDirty(false);
    targetPending.current = [];

    fetch(`/api/planning?year=${year}&planType=target`)
      .then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar metas");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setTargetData(json.entries ?? {});
          setTargetLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTargetLoading(false);
          setLoadError("Não foi possível carregar as metas de planejamento.");
        }
      });

    return () => { cancelled = true; };
  }, [year]);

  // Reset shared status on tab/year change
  useEffect(() => {
    setSaveStatus("idle");
    setSyncStatus("idle");
  }, [year, activeTab]);

  // Handle cell change — actual
  const handleActualCellChange = useCallback(
    (month: number, metric: string, value: number | undefined) => {
      setActualData((prev) => {
        const updated = { ...prev };
        if (!updated[month]) updated[month] = {};
        updated[month] = { ...updated[month] };
        if (value == null) {
          delete updated[month][metric];
        } else {
          updated[month][metric] = value;
        }
        return updated;
      });

      const existing = actualPending.current.findIndex(
        (c) => c.metric === metric && c.month === month
      );
      const entry = { metric, month, value: value ?? null };
      if (existing >= 0) actualPending.current[existing] = entry;
      else actualPending.current.push(entry);

      setActualDirty(true);
      setSaveStatus("idle");
    },
    []
  );

  // Handle cell change — target
  const handleTargetCellChange = useCallback(
    (month: number, metric: string, value: number | undefined) => {
      setTargetData((prev) => {
        const updated = { ...prev };
        if (!updated[month]) updated[month] = {};
        updated[month] = { ...updated[month] };
        if (value == null) {
          delete updated[month][metric];
        } else {
          updated[month][metric] = value;
        }
        return updated;
      });

      const existing = targetPending.current.findIndex(
        (c) => c.metric === metric && c.month === month
      );
      const entry = { metric, month, value: value ?? null };
      if (existing >= 0) targetPending.current[existing] = entry;
      else targetPending.current.push(entry);

      setTargetDirty(true);
      setSaveStatus("idle");
    },
    []
  );

  // Sync from platforms (only for actual tab)
  function requestSync() {
    if (actualDirty) {
      setShowSyncConfirm(true);
      return;
    }
    executeSync();
  }

  const executeSync = useCallback(async () => {
    setShowSyncConfirm(false);
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/planning/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao sincronizar");
      }

      const json = await res.json();
      setActualData(json.entries ?? {});
      setActualSources(json.sources ?? {});
      setLastSyncedAt(json.syncedAt ?? null);
      setSyncedCount(json.syncedMetrics ?? 0);
      actualPending.current = [];
      setActualDirty(false);
      setSyncStatus("synced");

      setTimeout(() => setSyncStatus("idle"), 5000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  }, [year]);

  // Save changes
  const handleSave = useCallback(async () => {
    const pending = isActual ? actualPending : targetPending;
    const planType = isActual ? "actual" : "target";
    if (pending.current.length === 0) return;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/planning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, planType, entries: pending.current }),
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      const json = await res.json();
      if (isActual) {
        setActualData(json.entries ?? {});
        setActualSources(json.sources ?? {});
        actualPending.current = [];
        setActualDirty(false);
      } else {
        setTargetData(json.entries ?? {});
        targetPending.current = [];
        setTargetDirty(false);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [year, isActual]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-zinc-900">Planejamento</h1>
          <YearSelector year={year} onChange={setYear} />
        </div>

        <div className="flex items-center gap-3">
          {/* Dirty indicator */}
          {dirty && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Alterações não salvas
            </span>
          )}

          {/* Save status */}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Salvo
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-4 w-4" /> Erro ao salvar
            </span>
          )}

          {/* Sync status (only actual tab) */}
          {isActual && syncStatus === "synced" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {syncedCount} métricas sincronizadas
            </span>
          )}
          {isActual && syncStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-4 w-4" /> Erro ao sincronizar
            </span>
          )}

          {/* Sync button (only actual tab) */}
          {isActual && (
            <button
              onClick={requestSync}
              disabled={syncStatus === "syncing"}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Puxa dados do Google Ads e GA4 para os meses disponíveis"
            >
              {syncStatus === "syncing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </button>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!dirty || saveStatus === "saving"}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar alterações
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("target")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "target"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Planejamento {year}
        </button>
        <button
          onClick={() => setActiveTab("actual")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "actual"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Dados do Período Atual – {year}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          {isActual ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-zinc-300 bg-white" />
                Editável
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-amber-200 bg-amber-50" />
                Cálculo automático
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-zinc-300 bg-zinc-100" />
                Sincronizado (plataforma)
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-orange-200 bg-orange-50" />
                Input manual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-zinc-300 bg-white" />
                Cálculo automático
              </span>
            </>
          )}
          <span className="text-zinc-400">&mdash; = Sem dados suficientes</span>
        </div>
        {isActual && lastSyncedAt && (
          <span className="text-zinc-400">
            Última sincronização: {new Date(lastSyncedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-400" />
          <p className="mt-2 text-sm text-zinc-500">Carregando dados de {year}...</p>
        </div>
      ) : activeTab === "target" ? (
        <TargetPlanningTable
          year={year}
          data={targetData}
          onCellChange={handleTargetCellChange}
        />
      ) : (
        <AnnualPlanningTable
          data={actualData}
          sources={actualSources}
          onCellChange={handleActualCellChange}
        />
      )}
      <ConfirmDialog
        open={showSyncConfirm}
        title="Sincronizar dados"
        message="Você tem alterações não salvas. A sincronização pode sobrescrever valores sincronizados anteriormente. Deseja continuar?"
        confirmLabel="Sincronizar"
        cancelLabel="Cancelar"
        onConfirm={executeSync}
        onCancel={() => setShowSyncConfirm(false)}
      />
    </div>
  );
}
