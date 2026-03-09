"use client";

import { EmptyIntegrationState } from "@/components/ui/empty-integration-state";
import { useCRMData } from "@/components/crm/crm-hooks";
import { CRMTopBar } from "@/components/crm/crm-top-bar";
import { KpiGrid } from "@/components/crm/kpi-cards";
import { ClientesBasePie, RetentionCurve } from "@/components/crm/customers-base";
import { CustomersByActionChart, TaxaAproveitamentoChart } from "@/components/crm/customers-action";
import { ClientesAtivosChart } from "@/components/crm/active-customers";
import { GeoTable } from "@/components/crm/geo-section";
import { PaymentTable } from "@/components/crm/payment-table";
import { DiscountSection } from "@/components/crm/discount-section";
import { TimeToRepurchaseChart } from "@/components/crm/time-repurchase";
import { AffinityTable } from "@/components/crm/affinity-table";
import { SkuTable, handleExportSku } from "@/components/crm/sku-table";
import { FrequencyChart, ChannelSection } from "@/components/crm/frequency-channel";
import GeoChart from "@/components/charts/geo-chart";
import ParetoChart from "@/components/charts/pareto-chart";
import { formatPct } from "@/lib/format";
import {
  Download,
  MapPin,
  CreditCard,
  Tag,
  Clock,
  Link2,
  BarChart3,
} from "lucide-react";

export default function RetentionOverviewPage() {
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
        title="Retenção"
        subtitle="Recompra, LTV, cohorts e inteligencia de dados"
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

      {s && <KpiGrid summary={s} />}

      {s && data?.frequencyBuckets && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ClientesBasePie repurchaseRate={s.repurchaseRate} />
          <RetentionCurve frequencyBuckets={data.frequencyBuckets} />
        </div>
      )}

      {data?.customersByAction && data.customersByAction.length > 0 && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <CustomersByActionChart data={data.customersByAction} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <TaxaAproveitamentoChart data={data.customersByAction} />
          </div>
        </>
      )}

      {data?.activeCustomers && data.activeCustomers.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <ClientesAtivosChart data={data.activeCustomers} />
        </div>
      )}

      {/* Pareto + Time to Repurchase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.pareto && data.pareto.curve.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Pareto de Receita</h2>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              <span className="font-semibold text-amber-600">{formatPct(data.pareto.pct80Revenue)}</span> dos clientes geram 80% da receita
            </p>
            <ParetoChart data={data.pareto} />
          </div>
        )}
        {data?.timeToRepurchase && data.timeToRepurchase.medianDays > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Tempo ate Recompra</h2>
            </div>
            <div className="flex gap-4 mb-4">
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-xs text-blue-600">Mediana</p>
                <p className="text-lg font-bold text-blue-700">{data.timeToRepurchase.medianDays} dias</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Media</p>
                <p className="text-lg font-bold text-zinc-700">{data.timeToRepurchase.avgDays} dias</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Janela ideal de remarketing: <span className="font-semibold text-emerald-600">{data.timeToRepurchase.medianDays} dias</span>
            </p>
            <TimeToRepurchaseChart data={data.timeToRepurchase} />
          </div>
        )}
      </div>

      {/* Geo + Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.geo && data.geo.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Inteligencia Geografica</h2>
            </div>
            <GeoChart data={data.geo} />
            <GeoTable data={data.geo} />
          </div>
        )}
        {data?.paymentMethods && data.paymentMethods.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={14} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Formas de Pagamento</h2>
            </div>
            <PaymentTable data={data.paymentMethods} />
          </div>
        )}
      </div>

      {/* Discount Impact */}
      {data?.discountImpact && data.discountImpact.withDiscount.orders > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Impacto de Descontos</h2>
          </div>
          <DiscountSection data={data.discountImpact} />
        </div>
      )}

      {/* Product Affinity */}
      {data?.productAffinity && data.productAffinity.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} className="text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Afinidade de Produtos</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-3">Pares de SKUs comprados juntos com mais frequencia</p>
          <AffinityTable data={data.productAffinity} />
        </div>
      )}

      {/* Repurchase by SKU */}
      {data?.repurchaseBySku && data.repurchaseBySku.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Recompra por SKU</h2>
            <button
              onClick={() => handleExportSku(data.repurchaseBySku)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Download size={12} />
              CSV
            </button>
          </div>
          <SkuTable data={data.repurchaseBySku} />
        </div>
      )}

      {/* Bottom row: Frequency + Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.frequencyBuckets && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Distribuicao de Frequencia</h2>
            <FrequencyChart data={data.frequencyBuckets} />
          </div>
        )}
        {data?.channelAttribution && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Atribuicao por Canal</h2>
            <ChannelSection data={data.channelAttribution} />
          </div>
        )}
      </div>
    </div>
  );
}
