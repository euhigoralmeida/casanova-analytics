import { NextRequest, NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-helpers";
import { getMagazordCredentials } from "@/lib/magazord";
import { fetchOrders, fetchLojas } from "@/lib/magazord-queries";
import type { MagazordOrder, MagazordLoja } from "@/lib/magazord-queries";
import { computeCRMAnalytics } from "@/lib/crm-engine";
import type { CRMAnalytics } from "@/lib/crm-engine";
import { fmtDate } from "@/lib/format";
import { logger } from "@/lib/logger";

export type Filial = {
  key: string;   // "1:" or "1:Mercado Livre"
  label: string;  // "Casanova Loja C&C" or "Casanova Loja C&C Mercado Livre"
  orders: number;
};

function discoverFiliais(orders: MagazordOrder[], lojas: MagazordLoja[]): Filial[] {
  const lojaMap = new Map<number, string>();
  for (const l of lojas) lojaMap.set(l.id, l.nome);

  const counts = new Map<string, { label: string; orders: number }>();

  for (const o of orders) {
    const key = `${o.lojaId}:${o.lojaDoMarketplaceNome || ""}`;
    if (!counts.has(key)) {
      const lojaNome = lojaMap.get(o.lojaId) || `Loja ${o.lojaId}`;
      const label = o.lojaDoMarketplaceNome
        ? `${lojaNome} ${o.lojaDoMarketplaceNome}`
        : lojaNome;
      counts.set(key, { label, orders: 0 });
    }
    counts.get(key)!.orders++;
  }

  return Array.from(counts.entries())
    .map(([key, v]) => ({ key, label: v.label, orders: v.orders }))
    .sort((a, b) => b.orders - a.orders);
}

function filterByFiliais(orders: MagazordOrder[], filialKeys: string[]): MagazordOrder[] {
  const keySet = new Set(filialKeys);
  return orders.filter((o) => {
    const key = `${o.lojaId}:${o.lojaDoMarketplaceNome || ""}`;
    return keySet.has(key);
  });
}

export async function GET(req: NextRequest) {
  const result = withTenantAuth(req);
  if ("error" in result) return result.error;
  const { tenantId } = result.ctx;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) {
    return NextResponse.json({
      source: "not_configured" as const,
      updatedAt: new Date().toISOString(),
      filiais: [],
      ...generateMockCRM(),
    });
  }

  try {
    const url = new URL(req.url);
    const now = new Date();

    // Parse date params with defaults (365 days)
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 365);
    const startDate = url.searchParams.get("startDate") || fmtDate(defaultStart);
    const endDate = url.searchParams.get("endDate") || fmtDate(now);
    const filiaisParam = url.searchParams.get("filiais"); // comma-separated keys

    // Fetch orders and lojas in parallel
    const [orders, lojas] = await Promise.all([
      fetchOrders(startDate, endDate, tenantId),
      fetchLojas(tenantId).catch(() => [] as MagazordLoja[]),
    ]);

    // Discover available filiais from all orders
    const availableFiliais = discoverFiliais(orders, lojas);

    // Filter orders if filiais param provided
    const filteredOrders = filiaisParam
      ? filterByFiliais(orders, filiaisParam.split(","))
      : orders;

    // Use endDate as reference date for RFM recency
    const referenceDate = new Date(endDate + "T23:59:59");
    const analytics = computeCRMAnalytics(filteredOrders, referenceDate);

    return NextResponse.json({
      source: "magazord" as const,
      updatedAt: new Date().toISOString(),
      filiais: availableFiliais,
      ...analytics,
    });
  } catch (e) {
    logger.error("CRM API error", { route: "/api/crm", tenantId }, e);
    return NextResponse.json(
      { error: "Erro ao carregar dados CRM" },
      { status: 500 },
    );
  }
}

// ---------- Mock Data ----------

function generateMockCRM(): CRMAnalytics {
  return {
    summary: {
      totalCustomers: 1842,
      totalOrders: 3156,
      totalRevenue: 892450.0,
      avgTicket: 282.78,
      repurchaseRate: 34.2,
      avgLTV: 484.50,
      churn90d: 22.5,
    },
    rfmDistribution: [
      { segment: "Campea", count: 142, revenue: 245800, avgTicket: 1731.69, color: "#10b981" },
      { segment: "Fiel", count: 287, revenue: 198600, avgTicket: 692.0, color: "#3b82f6" },
      { segment: "Potencial", count: 198, revenue: 124500, avgTicket: 628.79, color: "#8b5cf6" },
      { segment: "Nova", count: 356, revenue: 112300, avgTicket: 315.45, color: "#06b6d4" },
      { segment: "Em Risco", count: 245, revenue: 98700, avgTicket: 402.86, color: "#f59e0b" },
      { segment: "Hibernando", count: 312, revenue: 67200, avgTicket: 215.38, color: "#6b7280" },
      { segment: "Perdida", count: 302, revenue: 45350, avgTicket: 150.17, color: "#ef4444" },
    ],
    topCustomers: [
      { cpfCnpj: "***.***.***-01", orders: 18, revenue: 12450.0, lastOrderDate: "2026-02-28", recency: 6, rfmScore: "5-5-5", segment: "Campea" },
      { cpfCnpj: "***.***.***-02", orders: 15, revenue: 9870.0, lastOrderDate: "2026-03-01", recency: 5, rfmScore: "5-5-5", segment: "Campea" },
      { cpfCnpj: "***.***.***-03", orders: 12, revenue: 8920.0, lastOrderDate: "2026-02-15", recency: 19, rfmScore: "5-5-5", segment: "Campea" },
      { cpfCnpj: "***.***.***-04", orders: 11, revenue: 7650.0, lastOrderDate: "2026-01-20", recency: 45, rfmScore: "4-5-5", segment: "Campea" },
      { cpfCnpj: "***.***.***-05", orders: 9, revenue: 6340.0, lastOrderDate: "2026-02-22", recency: 12, rfmScore: "5-4-5", segment: "Campea" },
    ],
    cohorts: [
      { cohortMonth: "2025-09", totalCustomers: 145, months: [100, 32.4, 24.1, 18.6, 12.4, 8.3] },
      { cohortMonth: "2025-10", totalCustomers: 168, months: [100, 35.1, 26.8, 19.2, 14.3] },
      { cohortMonth: "2025-11", totalCustomers: 212, months: [100, 38.2, 28.5, 21.4] },
      { cohortMonth: "2025-12", totalCustomers: 287, months: [100, 42.1, 31.2] },
      { cohortMonth: "2026-01", totalCustomers: 198, months: [100, 36.7] },
      { cohortMonth: "2026-02", totalCustomers: 176, months: [100] },
    ],
    repurchaseBySku: [
      { sku: "27290BR-CP", nome: "Torneira Cozinha CP", totalBuyers: 423, repeatBuyers: 156, repurchaseRate: 36.9, totalQuantity: 612 },
      { sku: "31450BR-LX", nome: "Ducha Luxo LX", totalBuyers: 312, repeatBuyers: 98, repurchaseRate: 31.4, totalQuantity: 428 },
      { sku: "19820BR-ST", nome: "Misturador ST", totalBuyers: 287, repeatBuyers: 112, repurchaseRate: 39.0, totalQuantity: 445 },
      { sku: "24150BR-MR", nome: "Torneira Banheiro MR", totalBuyers: 198, repeatBuyers: 54, repurchaseRate: 27.3, totalQuantity: 264 },
      { sku: "33620BR-VL", nome: "Válvula Descarga VL", totalBuyers: 156, repeatBuyers: 67, repurchaseRate: 42.9, totalQuantity: 298 },
    ],
    frequencyBuckets: [
      { label: "1 compra", count: 1212, percentage: 65.8 },
      { label: "2 compras", count: 312, percentage: 16.9 },
      { label: "3-5 compras", count: 198, percentage: 10.8 },
      { label: "6-10 compras", count: 87, percentage: 4.7 },
      { label: "11+ compras", count: 33, percentage: 1.8 },
    ],
    channelAttribution: [
      { channel: "Google Shopping", orders: 1245, revenue: 356800, avgTicket: 286.51, percentage: 40.0 },
      { channel: "Orgânico", orders: 892, revenue: 234500, avgTicket: 262.89, percentage: 26.3 },
      { channel: "Meta Ads", orders: 456, revenue: 142300, avgTicket: 312.06, percentage: 15.9 },
      { channel: "Direto", orders: 312, revenue: 89450, avgTicket: 286.70, percentage: 10.0 },
      { channel: "E-mail", orders: 156, revenue: 45200, avgTicket: 289.74, percentage: 5.1 },
      { channel: "Outros", orders: 95, revenue: 24200, avgTicket: 254.74, percentage: 2.7 },
    ],
    geo: [
      { uf: "SP", orders: 1024, revenue: 312400, customers: 645, avgTicket: 305.08, repurchaseRate: 38.1 },
      { uf: "RJ", orders: 498, revenue: 142800, customers: 312, avgTicket: 286.75, repurchaseRate: 32.4 },
      { uf: "MG", orders: 356, revenue: 98700, customers: 234, avgTicket: 277.25, repurchaseRate: 29.5 },
      { uf: "PR", orders: 287, revenue: 82400, customers: 189, avgTicket: 287.11, repurchaseRate: 35.2 },
      { uf: "SC", orders: 234, revenue: 67800, customers: 156, avgTicket: 289.74, repurchaseRate: 33.8 },
      { uf: "RS", orders: 198, revenue: 54200, customers: 132, avgTicket: 273.74, repurchaseRate: 28.7 },
      { uf: "BA", orders: 145, revenue: 38600, customers: 98, avgTicket: 266.21, repurchaseRate: 24.5 },
      { uf: "GO", orders: 112, revenue: 29800, customers: 76, avgTicket: 266.07, repurchaseRate: 22.1 },
      { uf: "PE", orders: 98, revenue: 24500, customers: 67, avgTicket: 250.00, repurchaseRate: 20.9 },
      { uf: "CE", orders: 78, revenue: 19200, customers: 54, avgTicket: 246.15, repurchaseRate: 18.5 },
    ],
    paymentMethods: [
      { method: "Pix", orders: 1256, revenue: 378900, avgTicket: 301.67, percentage: 42.5, repurchaseRate: 36.8 },
      { method: "Cartão de Crédito", orders: 1024, revenue: 312400, avgTicket: 305.08, percentage: 35.0, repurchaseRate: 32.1 },
      { method: "Boleto", orders: 534, revenue: 124500, avgTicket: 233.15, percentage: 14.0, repurchaseRate: 28.4 },
      { method: "Cartão de Débito", orders: 198, revenue: 48200, avgTicket: 243.43, percentage: 5.4, repurchaseRate: 22.6 },
      { method: "Outros", orders: 144, revenue: 28450, avgTicket: 197.57, percentage: 3.2, repurchaseRate: 19.3 },
    ],
    discountImpact: {
      withDiscount: { orders: 876, revenue: 198400, avgTicket: 226.48, repurchaseRate: 41.2 },
      withoutDiscount: { orders: 2280, revenue: 694050, avgTicket: 304.41, repurchaseRate: 30.8 },
      discountLift: 33.8,
    },
    timeToRepurchase: {
      medianDays: 42,
      avgDays: 56,
      buckets: [
        { label: "0-7 dias", count: 45, percentage: 7.1 },
        { label: "8-14 dias", count: 67, percentage: 10.6 },
        { label: "15-30 dias", count: 134, percentage: 21.3 },
        { label: "31-60 dias", count: 178, percentage: 28.3 },
        { label: "61-90 dias", count: 112, percentage: 17.8 },
        { label: "90+ dias", count: 94, percentage: 14.9 },
      ],
    },
    productAffinity: [
      { skuA: "27290BR-CP", nomeA: "Torneira Cozinha CP", skuB: "33620BR-VL", nomeB: "Válvula Descarga VL", coOccurrences: 87 },
      { skuA: "27290BR-CP", nomeA: "Torneira Cozinha CP", skuB: "24150BR-MR", nomeB: "Torneira Banheiro MR", coOccurrences: 72 },
      { skuA: "31450BR-LX", nomeA: "Ducha Luxo LX", skuB: "19820BR-ST", nomeB: "Misturador ST", coOccurrences: 65 },
      { skuA: "24150BR-MR", nomeA: "Torneira Banheiro MR", skuB: "33620BR-VL", nomeB: "Válvula Descarga VL", coOccurrences: 54 },
      { skuA: "19820BR-ST", nomeA: "Misturador ST", skuB: "27290BR-CP", nomeB: "Torneira Cozinha CP", coOccurrences: 48 },
      { skuA: "31450BR-LX", nomeA: "Ducha Luxo LX", skuB: "24150BR-MR", nomeB: "Torneira Banheiro MR", coOccurrences: 41 },
      { skuA: "33620BR-VL", nomeA: "Válvula Descarga VL", skuB: "19820BR-ST", nomeB: "Misturador ST", coOccurrences: 38 },
      { skuA: "27290BR-CP", nomeA: "Torneira Cozinha CP", skuB: "31450BR-LX", nomeB: "Ducha Luxo LX", coOccurrences: 35 },
    ],
    pareto: {
      pct80Revenue: 23.4,
      curve: [
        { customerPct: 10, revenuePct: 52.3 },
        { customerPct: 20, revenuePct: 74.8 },
        { customerPct: 30, revenuePct: 85.2 },
        { customerPct: 40, revenuePct: 91.1 },
        { customerPct: 50, revenuePct: 94.8 },
        { customerPct: 60, revenuePct: 96.9 },
        { customerPct: 70, revenuePct: 98.2 },
        { customerPct: 80, revenuePct: 99.0 },
        { customerPct: 90, revenuePct: 99.6 },
        { customerPct: 100, revenuePct: 100 },
      ],
    },
    customersByAction: [
      { month: "2025-03", retidos: 5, reativados: 3, recuperados: 2, novos: 127 },
      { month: "2025-04", retidos: 7, reativados: 4, recuperados: 2, novos: 118 },
      { month: "2025-05", retidos: 8, reativados: 4, recuperados: 2, novos: 104 },
      { month: "2025-06", retidos: 5, reativados: 2, recuperados: 1, novos: 95 },
      { month: "2025-07", retidos: 3, reativados: 2, recuperados: 1, novos: 107 },
      { month: "2025-08", retidos: 9, reativados: 4, recuperados: 3, novos: 81 },
      { month: "2025-09", retidos: 9, reativados: 5, recuperados: 3, novos: 87 },
      { month: "2025-10", retidos: 8, reativados: 4, recuperados: 2, novos: 94 },
      { month: "2025-11", retidos: 9, reativados: 4, recuperados: 2, novos: 119 },
      { month: "2025-12", retidos: 11, reativados: 5, recuperados: 3, novos: 64 },
      { month: "2026-01", retidos: 5, reativados: 3, recuperados: 2, novos: 80 },
      { month: "2026-02", retidos: 4, reativados: 3, recuperados: 2, novos: 79 },
      { month: "2026-03", retidos: 3, reativados: 2, recuperados: 1, novos: 24 },
    ],
    activeCustomers: [
      { month: "2025-03", active: 270 },
      { month: "2025-04", active: 341 },
      { month: "2025-05", active: 376 },
      { month: "2025-06", active: 372 },
      { month: "2025-07", active: 338 },
      { month: "2025-08", active: 313 },
      { month: "2025-09", active: 297 },
      { month: "2025-10", active: 284 },
      { month: "2025-11", active: 289 },
      { month: "2025-12", active: 324 },
      { month: "2026-01", active: 302 },
      { month: "2026-02", active: 285 },
      { month: "2026-03", active: 255 },
    ],
  };
}
