"use client";

import { useState } from "react";
import { EmptyIntegrationState } from "@/components/ui/empty-integration-state";
import { useCRMData } from "@/components/crm/crm-hooks";
import { CRMTopBar } from "@/components/crm/crm-top-bar";
import { KpiCard } from "@/components/crm/kpi-cards";
import { RfmGridChart, RfmDrilldown, RfmTable, handleExportRfmSegments, handleExportCustomers } from "@/components/crm/rfm-section";
import { formatBRL, formatPct } from "@/lib/format";
import { Download, Users, Repeat, TrendingUp } from "lucide-react";

export default function RetentionRfmPage() {
  const crm = useCRMData();
  const [drillSegment, setDrillSegment] = useState<string | null>(null);

  if (crm.blocked) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <EmptyIntegrationState
          platform="Retenção"
          message="Módulo Retenção não disponível para este tenant."
        />
      </div>
    );
  }

  if (crm.error && !crm.data) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {crm.error}
        </div>
      </div>
    );
  }

  if (!crm.loading && crm.data?.source === "not_configured" && !crm.data.summary.totalCustomers) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <EmptyIntegrationState
          platform="Magazord"
          message="Magazord não configurado. Configure a integração nas Configurações para ver dados reais de Retenção."
        />
      </div>
    );
  }

  const data = crm.data;
  const s = data?.summary;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      <CRMTopBar
        title="Análise RFM"
        subtitle="Segmentação RFM, drill-down por segmento e exportação"
        source={data?.source}
        loading={crm.loading}
        updatedLabel={crm.updatedLabel}
        dateRange={crm.dateRange}
        availableFiliais={crm.availableFiliais}
        selectedFiliais={crm.selectedFiliais}
        onDateChange={crm.handleDateChange}
        onFiliaisChange={crm.handleFiliaisChange}
        onRefresh={crm.refresh}
      />

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard icon={Users} label="Clientes" value={s.totalCustomers.toLocaleString("pt-BR")} />
          <KpiCard icon={Repeat} label="Recompra" value={formatPct(s.repurchaseRate)} color={s.repurchaseRate >= 30 ? "emerald" : s.repurchaseRate >= 20 ? "amber" : "red"} />
          <KpiCard icon={TrendingUp} label="LTV Medio" value={formatBRL(s.avgLTV)} />
        </div>
      )}

      {data?.rfmDistribution && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Analise RFM</h2>
            <button
              onClick={() => handleExportRfmSegments(data.rfmDistribution, data.topCustomers)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Download size={12} />
              CSV
            </button>
          </div>

          <RfmGridChart
            distribution={data.rfmDistribution}
            activeSegment={drillSegment}
            onSegmentClick={(seg) => setDrillSegment(drillSegment === seg ? null : seg)}
          />

          {drillSegment && (
            <RfmDrilldown
              segment={drillSegment}
              distribution={data.rfmDistribution.find((d) => d.segment === drillSegment) ?? null}
              customers={data.topCustomers.filter((c) => c.segment === drillSegment)}
              onClose={() => setDrillSegment(null)}
              onExport={(customers) => handleExportCustomers(customers, drillSegment)}
            />
          )}

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Distribuicao por Segmento</h3>
            <RfmTable data={data.rfmDistribution} onSegmentClick={(seg) => setDrillSegment(drillSegment === seg ? null : seg)} />
          </div>
        </div>
      )}
    </div>
  );
}
