"use client";

import { formatBRL, formatPct, fmtDateSlash } from "@/lib/format";
import { exportToCSV } from "@/lib/export-csv";
import { Download, X, CalendarDays, ShoppingBag, Wallet } from "lucide-react";
import type { RFMDistribution, CustomerRFM } from "@/lib/crm-engine";

const RFM_GRID_COLORS: Record<string, string> = {
  Campea: "#2d6a4f",
  Fiel: "#95d5b2",
  Potencial: "#1d3557",
  Nova: "#7b2cbf",
  "Em Risco": "#e76f51",
  Hibernando: "#6d2e46",
  Perdida: "#264653",
};

const RFM_TEXT_COLORS: Record<string, string> = {
  Campea: "#fff",
  Fiel: "#1b4332",
  Potencial: "#fff",
  Nova: "#fff",
  "Em Risco": "#fff",
  Hibernando: "#fff",
  Perdida: "#fff",
};

const RFM_GRID_POSITIONS: { segment: string; gridRow: string; gridCol: string }[] = [
  { segment: "Em Risco", gridRow: "1 / 3", gridCol: "2 / 4" },
  { segment: "Fiel", gridRow: "1 / 3", gridCol: "4 / 6" },
  { segment: "Campea", gridRow: "1 / 3", gridCol: "6 / 7" },
  { segment: "Hibernando", gridRow: "3 / 4", gridCol: "2 / 4" },
  { segment: "Potencial", gridRow: "3 / 5", gridCol: "4 / 7" },
  { segment: "Perdida", gridRow: "4 / 6", gridCol: "2 / 4" },
  { segment: "Nova", gridRow: "5 / 6", gridCol: "4 / 7" },
];

export function RfmGridChart({ distribution, activeSegment, onSegmentClick }: {
  distribution: RFMDistribution[];
  activeSegment: string | null;
  onSegmentClick: (segment: string) => void;
}) {
  const segMap = new Map(distribution.map((d) => [d.segment, d]));

  return (
    <div className="flex gap-2">
      <div className="flex items-center justify-center shrink-0 w-5">
        <span className="text-[10px] text-zinc-500 font-medium whitespace-nowrap" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
          Media entre frequencia e monetariedade
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: "28px repeat(5, 1fr)",
            gridTemplateRows: "repeat(5, 64px) auto",
          }}
        >
          {[5, 4, 3, 2, 1].map((n, i) => (
            <div key={`y-${n}`} className="flex items-center justify-center text-xs text-zinc-500 font-medium" style={{ gridRow: `${i + 1}`, gridColumn: "1" }}>
              {n}
            </div>
          ))}

          {RFM_GRID_POSITIONS.map((pos) => {
            const seg = segMap.get(pos.segment as RFMDistribution["segment"]);
            const count = seg?.count ?? 0;
            const isActive = activeSegment === pos.segment;
            const bg = RFM_GRID_COLORS[pos.segment] || "#94a3b8";
            const textColor = RFM_TEXT_COLORS[pos.segment] || "#fff";

            return (
              <button
                key={pos.segment}
                onClick={() => onSegmentClick(pos.segment)}
                className={`rounded-md flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isActive ? "ring-2 ring-offset-1 ring-zinc-900 scale-[1.02]" : "hover:opacity-90"
                }`}
                style={{
                  gridRow: pos.gridRow,
                  gridColumn: pos.gridCol,
                  backgroundColor: bg,
                  color: textColor,
                  opacity: activeSegment && !isActive ? 0.45 : 1,
                }}
              >
                <span className="text-xs font-semibold leading-tight">{pos.segment}</span>
                <span className="text-lg font-bold">{count}</span>
              </button>
            );
          })}

          <div style={{ gridRow: "6", gridColumn: "1" }} />
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={`x-${n}`} className="flex items-center justify-center text-xs text-zinc-500 font-medium pt-1" style={{ gridRow: "6", gridColumn: `${n + 1}` }}>
              {n}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-zinc-500 font-medium text-center mt-1">Recencia</p>
      </div>
    </div>
  );
}

export function RfmDrilldown({ segment, distribution, customers, onClose, onExport }: {
  segment: string;
  distribution: RFMDistribution | null;
  customers: CustomerRFM[];
  onClose: () => void;
  onExport: (customers: CustomerRFM[]) => void;
}) {
  const d = distribution;

  const lastPurchaseLabel = d?.lastPurchaseMin && d?.lastPurchaseMax
    ? `${fmtDateSlash(d.lastPurchaseMin)} - ${fmtDateSlash(d.lastPurchaseMax)}`
    : "\u2014";
  const ordersLabel = d?.ordersMin !== undefined && d?.ordersMax !== undefined
    ? d.ordersMin === d.ordersMax ? `${d.ordersMin} compras` : `${d.ordersMin} a ${d.ordersMax} compras`
    : "\u2014";
  const revenueLabel = d?.revenueMin !== undefined && d?.revenueMax !== undefined
    ? `${formatBRL(d.revenueMin)} a ${formatBRL(d.revenueMax)}`
    : "\u2014";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900">{segment}</h3>
        <div className="flex items-center gap-2">
          {customers.length > 0 && (
            <button
              onClick={() => onExport(customers)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Download size={12} />
              Exportar
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
          <CalendarDays size={20} className="text-zinc-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-800">{lastPurchaseLabel}</p>
            <p className="text-xs text-zinc-500">Ultima compra</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
          <ShoppingBag size={20} className="text-zinc-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-800">{ordersLabel}</p>
            <p className="text-xs text-zinc-500">Feitas nos ultimos 365 dias</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
          <Wallet size={20} className="text-zinc-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-800">{revenueLabel}</p>
            <p className="text-xs text-zinc-500">Gasto nos ultimos 365 dias</p>
          </div>
        </div>
      </div>

      {customers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-white" style={{ backgroundColor: RFM_GRID_COLORS[segment] || "#2d6a4f" }}>
                <th className="px-3 py-2 font-medium rounded-tl-lg">Cliente</th>
                <th className="px-3 py-2 font-medium text-right">Recencia</th>
                <th className="px-3 py-2 font-medium text-right">Frequencia</th>
                <th className="px-3 py-2 font-medium text-right">Monetario</th>
                <th className="px-3 py-2 font-medium text-right rounded-tr-lg">RFM Score</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.cpfCnpj} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-mono text-zinc-700">{c.cpfCnpj}</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{c.recency}d</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{c.orders}</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{formatBRL(c.revenue)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-600">{c.rfmScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Nenhum cliente neste segmento.</p>
      )}
    </div>
  );
}

export function RfmTable({ data, onSegmentClick }: { data: RFMDistribution[]; onSegmentClick?: (segment: string) => void }) {
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">Segmento</th>
            <th className="px-3 py-2 font-medium text-right">Clientes</th>
            <th className="px-3 py-2 font-medium text-right">%</th>
            <th className="px-3 py-2 font-medium text-right">Receita</th>
            <th className="px-3 py-2 font-medium text-right">Ticket</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr
              key={d.segment}
              className={`border-t border-zinc-100 ${onSegmentClick ? "cursor-pointer hover:bg-zinc-50" : ""}`}
              onClick={() => onSegmentClick?.(d.segment)}
            >
              <td className="px-3 py-2 font-medium text-zinc-700">
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: d.color }} />
                {d.segment}
              </td>
              <td className="px-3 py-2 text-right text-zinc-600">{d.count.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right text-zinc-600">
                {totalCount > 0 ? formatPct((d.count / totalCount) * 100) : "0%"}
              </td>
              <td className="px-3 py-2 text-right text-zinc-600">{formatBRL(d.revenue)}</td>
              <td className="px-3 py-2 text-right text-zinc-600">{formatBRL(d.avgTicket)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function handleExportRfmSegments(segments: RFMDistribution[], customers: CustomerRFM[]) {
  exportToCSV(
    customers,
    [
      { key: "cpfCnpj", label: "CPF/CNPJ" },
      { key: "segment", label: "Segmento" },
      { key: "orders", label: "Pedidos" },
      { key: "revenue", label: "Receita" },
      { key: "lastOrderDate", label: "Ultima Compra" },
      { key: "recency", label: "Recencia (dias)" },
      { key: "rfmScore", label: "Score RFM" },
    ],
    "segmentos-rfm.csv",
  );
}

export function handleExportCustomers(customers: CustomerRFM[], segment: string) {
  exportToCSV(
    customers,
    [
      { key: "cpfCnpj", label: "CPF/CNPJ" },
      { key: "segment", label: "Segmento" },
      { key: "orders", label: "Pedidos" },
      { key: "revenue", label: "Receita" },
      { key: "lastOrderDate", label: "Ultima Compra" },
      { key: "recency", label: "Recencia (dias)" },
      { key: "rfmScore", label: "Score RFM" },
    ],
    `clientes-${segment.toLowerCase().replace(/\s/g, "-")}.csv`,
  );
}
