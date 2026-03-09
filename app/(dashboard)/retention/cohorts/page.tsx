"use client";

import { EmptyIntegrationState } from "@/components/ui/empty-integration-state";
import { useCRMData } from "@/components/crm/crm-hooks";
import { CRMTopBar } from "@/components/crm/crm-top-bar";
import { KpiCard } from "@/components/crm/kpi-cards";
import { CohortHeatmap } from "@/components/crm/cohort-heatmap";
import { formatBRL, formatPct } from "@/lib/format";
import { Users, Repeat, Receipt } from "lucide-react";

export default function RetentionCohortsPage() {
  const crm = useCRMData();

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
        title="Cohorts de Recompra"
        subtitle="Análise de cohorts mensais de recompra"
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
          <KpiCard icon={Receipt} label="Ticket Medio" value={formatBRL(s.avgTicket)} />
        </div>
      )}

      {data?.cohorts && data.cohorts.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Cohorts de Recompra</h2>
          <CohortHeatmap data={data.cohorts} />
        </div>
      )}
    </div>
  );
}
