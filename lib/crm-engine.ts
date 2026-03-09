/**
 * CRM Analytics Engine — pure computation, no I/O.
 * Computes RFM segmentation, cohorts, repurchase rates, LTV, and channel attribution
 * from Magazord order data.
 */

import type { MagazordOrder } from "@/lib/magazord-queries";

// ---------- Output Types ----------

export type CRMSummary = {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgTicket: number;
  repurchaseRate: number; // % of customers with 2+ orders
  avgLTV: number;
  churn90d: number; // % of customers with no order in last 90d (among those who bought before that)
};

export type RFMSegment =
  | "Campea"
  | "Fiel"
  | "Potencial"
  | "Nova"
  | "Em Risco"
  | "Hibernando"
  | "Perdida";

export type RFMDistribution = {
  segment: RFMSegment;
  count: number;
  revenue: number;
  avgTicket: number;
  color: string;
  lastPurchaseMin?: string;
  lastPurchaseMax?: string;
  ordersMin?: number;
  ordersMax?: number;
  revenueMin?: number;
  revenueMax?: number;
};

export type CustomerRFM = {
  cpfCnpj: string;
  orders: number;
  revenue: number;
  lastOrderDate: string;
  recency: number; // days
  rfmScore: string; // e.g. "5-4-5"
  segment: RFMSegment;
};

export type CohortRow = {
  cohortMonth: string; // "2025-01"
  totalCustomers: number;
  months: number[]; // repurchase % for month 0, 1, 2, ...
};

export type RepurchaseBySku = {
  sku: string;
  nome: string;
  totalBuyers: number;
  repeatBuyers: number;
  repurchaseRate: number;
  totalQuantity: number;
};

export type FrequencyBucket = {
  label: string;
  count: number;
  percentage: number;
};

export type ChannelAttribution = {
  channel: string;
  orders: number;
  revenue: number;
  avgTicket: number;
  percentage: number;
};

export type GeoRow = {
  uf: string;
  orders: number;
  revenue: number;
  customers: number;
  avgTicket: number;
  repurchaseRate: number;
};

export type PaymentMethodRow = {
  method: string;
  orders: number;
  revenue: number;
  avgTicket: number;
  percentage: number;
  repurchaseRate: number;
};

export type DiscountImpact = {
  withDiscount: { orders: number; revenue: number; avgTicket: number; repurchaseRate: number };
  withoutDiscount: { orders: number; revenue: number; avgTicket: number; repurchaseRate: number };
  discountLift: number; // % increase in repurchase with discount
};

export type TimeToRepurchase = {
  medianDays: number;
  avgDays: number;
  buckets: { label: string; count: number; percentage: number }[];
};

export type ProductAffinityPair = {
  skuA: string;
  nomeA: string;
  skuB: string;
  nomeB: string;
  coOccurrences: number;
};

export type ParetoData = {
  pct80Revenue: number; // % of customers that generate 80% of revenue
  curve: { customerPct: number; revenuePct: number }[];
};

export type CustomersByActionMonth = {
  month: string; // "2025-03"
  retidos: number;     // returned within 60d
  reativados: number;  // returned between 60-90d
  recuperados: number; // returned after 90d+
  novos: number;       // first purchase ever
};

export type ActiveCustomersMonth = {
  month: string;  // "2025-03"
  active: number; // unique customers with order in prior 90 days
};

export type CRMAnalytics = {
  summary: CRMSummary;
  rfmDistribution: RFMDistribution[];
  topCustomers: CustomerRFM[];
  cohorts: CohortRow[];
  repurchaseBySku: RepurchaseBySku[];
  frequencyBuckets: FrequencyBucket[];
  channelAttribution: ChannelAttribution[];
  geo: GeoRow[];
  paymentMethods: PaymentMethodRow[];
  discountImpact: DiscountImpact;
  timeToRepurchase: TimeToRepurchase;
  productAffinity: ProductAffinityPair[];
  pareto: ParetoData;
  customersByAction: CustomersByActionMonth[];
  activeCustomers: ActiveCustomersMonth[];
};

// ---------- Helpers ----------

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function quintile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.indexOf(value);
  const pct = sorted.length > 1 ? idx / (sorted.length - 1) : 0.5;
  if (pct >= 0.8) return 5;
  if (pct >= 0.6) return 4;
  if (pct >= 0.4) return 3;
  if (pct >= 0.2) return 2;
  return 1;
}

function classifyRFM(r: number, f: number, m: number): RFMSegment {
  if (r >= 4 && f >= 4 && m >= 4) return "Campea";
  if (r >= 3 && f >= 3 && m >= 3) return "Fiel";
  if (r >= 4 && f <= 2 && m >= 3) return "Potencial";
  if (r >= 4 && f === 1) return "Nova";
  if (r <= 2 && f >= 3) return "Em Risco";
  if (r === 1 && f === 1 && m <= 2) return "Perdida";
  if (r <= 2 && f <= 2) return "Hibernando";
  return "Fiel"; // fallback
}

const SEGMENT_COLORS: Record<RFMSegment, string> = {
  Campea: "#10b981",
  Fiel: "#3b82f6",
  Potencial: "#8b5cf6",
  Nova: "#06b6d4",
  "Em Risco": "#f59e0b",
  Hibernando: "#6b7280",
  Perdida: "#ef4444",
};

// ---------- Main Computation ----------

type CustomerAgg = {
  cpfCnpj: string;
  orders: number;
  revenue: number;
  firstOrderDate: Date;
  lastOrderDate: Date;
  orderDates: Date[];
  skus: Set<string>;
};

export function computeCRMAnalytics(
  orders: MagazordOrder[],
  referenceDate: Date = new Date(),
): CRMAnalytics {
  if (orders.length === 0) return emptyAnalytics();

  // Aggregate by customer (pessoaCpfCnpj)
  const customers = new Map<string, CustomerAgg>();
  for (const order of orders) {
    const key = order.pessoaCpfCnpj;
    if (!key) continue;
    const dt = new Date(order.dataHora);
    const val = parseFloat(order.valorTotal) || 0;
    const existing = customers.get(key);
    if (existing) {
      existing.orders++;
      existing.revenue += val;
      if (dt < existing.firstOrderDate) existing.firstOrderDate = dt;
      if (dt > existing.lastOrderDate) existing.lastOrderDate = dt;
      existing.orderDates.push(dt);
      for (const item of order.itens ?? []) existing.skus.add(item.sku);
    } else {
      customers.set(key, {
        cpfCnpj: key,
        orders: 1,
        revenue: val,
        firstOrderDate: dt,
        lastOrderDate: dt,
        orderDates: [dt],
        skus: new Set((order.itens ?? []).map((i) => i.sku)),
      });
    }
  }

  const custArray = Array.from(customers.values());
  const totalCustomers = custArray.length;
  const totalOrders = orders.length;
  const totalRevenue = custArray.reduce((s, c) => s + c.revenue, 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const repeatCustomers = custArray.filter((c) => c.orders >= 2).length;
  const repurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Churn 90d: customers whose last order was >90d ago (among those who had at least one order before 90d ago)
  const d90 = new Date(referenceDate);
  d90.setDate(d90.getDate() - 90);
  const eligibleForChurn = custArray.filter((c) => c.firstOrderDate < d90);
  const churned = eligibleForChurn.filter((c) => c.lastOrderDate < d90);
  const churn90d = eligibleForChurn.length > 0 ? (churned.length / eligibleForChurn.length) * 100 : 0;

  const summary: CRMSummary = {
    totalCustomers,
    totalOrders,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgTicket: Math.round(avgTicket * 100) / 100,
    repurchaseRate: Math.round(repurchaseRate * 10) / 10,
    avgLTV: Math.round(avgLTV * 100) / 100,
    churn90d: Math.round(churn90d * 10) / 10,
  };

  // RFM scoring
  const recencies = custArray.map((c) => daysBetween(c.lastOrderDate, referenceDate));
  const frequencies = custArray.map((c) => c.orders);
  const monetaries = custArray.map((c) => c.revenue);

  // Recency: lower is better, so invert the quintile
  const recencySorted = [...recencies].sort((a, b) => a - b);

  const customerRFMs: CustomerRFM[] = custArray.map((c, i) => {
    const rec = recencies[i];
    // For recency, lower days = higher score, so invert
    const rIdx = recencySorted.indexOf(rec);
    const rPct = recencySorted.length > 1 ? 1 - rIdx / (recencySorted.length - 1) : 0.5;
    const r = rPct >= 0.8 ? 5 : rPct >= 0.6 ? 4 : rPct >= 0.4 ? 3 : rPct >= 0.2 ? 2 : 1;
    const f = quintile(frequencies, c.orders);
    const m = quintile(monetaries, c.revenue);
    const segment = classifyRFM(r, f, m);
    return {
      cpfCnpj: c.cpfCnpj,
      orders: c.orders,
      revenue: Math.round(c.revenue * 100) / 100,
      lastOrderDate: c.lastOrderDate.toISOString().slice(0, 10),
      recency: rec,
      rfmScore: `${r}-${f}-${m}`,
      segment,
    };
  });

  // RFM distribution with per-segment ranges
  const segmentAgg = new Map<RFMSegment, {
    count: number; revenue: number;
    lastDates: string[]; orders: number[]; revenues: number[];
  }>();
  for (const c of customerRFMs) {
    const existing = segmentAgg.get(c.segment) ?? {
      count: 0, revenue: 0, lastDates: [], orders: [], revenues: [],
    };
    existing.count++;
    existing.revenue += c.revenue;
    existing.lastDates.push(c.lastOrderDate);
    existing.orders.push(c.orders);
    existing.revenues.push(c.revenue);
    segmentAgg.set(c.segment, existing);
  }

  const allSegments: RFMSegment[] = ["Campea", "Fiel", "Potencial", "Nova", "Em Risco", "Hibernando", "Perdida"];
  const rfmDistribution: RFMDistribution[] = allSegments
    .map((segment) => {
      const d = segmentAgg.get(segment);
      if (!d || d.count === 0) return null;
      const sortedDates = [...d.lastDates].sort();
      const sortedOrders = [...d.orders].sort((a, b) => a - b);
      const sortedRevenues = [...d.revenues].sort((a, b) => a - b);
      return {
        segment,
        count: d.count,
        revenue: Math.round(d.revenue * 100) / 100,
        avgTicket: Math.round((d.revenue / d.count) * 100) / 100,
        color: SEGMENT_COLORS[segment],
        lastPurchaseMin: sortedDates[0],
        lastPurchaseMax: sortedDates[sortedDates.length - 1],
        ordersMin: sortedOrders[0],
        ordersMax: sortedOrders[sortedOrders.length - 1],
        revenueMin: Math.round(sortedRevenues[0] * 100) / 100,
        revenueMax: Math.round(sortedRevenues[sortedRevenues.length - 1] * 100) / 100,
      };
    })
    .filter((d) => d !== null) as RFMDistribution[];

  // Top 10 customers per segment (for drill-down)
  const topCustomers: CustomerRFM[] = [];
  for (const seg of allSegments) {
    const segCusts = customerRFMs
      .filter((c) => c.segment === seg)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    topCustomers.push(...segCusts);
  }

  // Cohorts by first purchase month
  const cohorts = computeCohorts(custArray, referenceDate);

  // Repurchase by SKU
  const repurchaseBySku = computeRepurchaseBySku(orders);

  // Frequency distribution
  const frequencyBuckets = computeFrequencyBuckets(custArray);

  // Channel attribution
  const channelAttribution = computeChannelAttribution(orders);

  // V2 analyses
  const geo = computeGeo(orders);
  const paymentMethods = computePaymentMethods(orders);
  const discountImpact = computeDiscountImpact(orders);
  const timeToRepurchase = computeTimeToRepurchase(custArray);
  const productAffinity = computeProductAffinity(orders);
  const pareto = computePareto(custArray);
  const customersByAction = computeCustomersByAction(orders);
  const activeCustomers = computeActiveCustomers(orders);

  return {
    summary,
    rfmDistribution,
    topCustomers,
    cohorts,
    repurchaseBySku,
    frequencyBuckets,
    channelAttribution,
    geo,
    paymentMethods,
    discountImpact,
    timeToRepurchase,
    productAffinity,
    pareto,
    customersByAction,
    activeCustomers,
  };
}

function computeCohorts(customers: CustomerAgg[], referenceDate: Date): CohortRow[] {
  const cohortMap = new Map<string, { customers: CustomerAgg[] }>();
  for (const c of customers) {
    const key = `${c.firstOrderDate.getFullYear()}-${String(c.firstOrderDate.getMonth() + 1).padStart(2, "0")}`;
    const existing = cohortMap.get(key) ?? { customers: [] };
    existing.customers.push(c);
    cohortMap.set(key, existing);
  }

  const refMonth = referenceDate.getFullYear() * 12 + referenceDate.getMonth();

  return Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortMonth, { customers: cohortCustomers }]) => {
      const [y, m] = cohortMonth.split("-").map(Number);
      const startMonth = y * 12 + (m - 1);
      const maxMonths = Math.min(refMonth - startMonth + 1, 12);
      const totalCustomers = cohortCustomers.length;

      const months: number[] = [];
      for (let i = 0; i < maxMonths; i++) {
        const monthStart = new Date(y, m - 1 + i, 1);
        const monthEnd = new Date(y, m + i, 0, 23, 59, 59);
        const active = cohortCustomers.filter((c) =>
          c.orderDates.some((d) => d >= monthStart && d <= monthEnd),
        ).length;
        months.push(totalCustomers > 0 ? Math.round((active / totalCustomers) * 1000) / 10 : 0);
      }

      return { cohortMonth, totalCustomers, months };
    });
}

function computeRepurchaseBySku(orders: MagazordOrder[]): RepurchaseBySku[] {
  const skuMap = new Map<string, { nome: string; buyers: Map<string, number>; totalQty: number }>();

  for (const order of orders) {
    for (const item of order.itens ?? []) {
      const existing = skuMap.get(item.sku) ?? { nome: item.nome, buyers: new Map(), totalQty: 0 };
      existing.totalQty += item.quantidade;
      const prev = existing.buyers.get(order.pessoaCpfCnpj) ?? 0;
      existing.buyers.set(order.pessoaCpfCnpj, prev + 1);
      skuMap.set(item.sku, existing);
    }
  }

  return Array.from(skuMap.entries())
    .map(([sku, data]) => {
      const totalBuyers = data.buyers.size;
      const repeatBuyers = Array.from(data.buyers.values()).filter((v) => v >= 2).length;
      return {
        sku,
        nome: data.nome,
        totalBuyers,
        repeatBuyers,
        repurchaseRate: totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 1000) / 10 : 0,
        totalQuantity: data.totalQty,
      };
    })
    .sort((a, b) => b.totalBuyers - a.totalBuyers)
    .slice(0, 30);
}

function computeFrequencyBuckets(customers: CustomerAgg[]): FrequencyBucket[] {
  const buckets: { label: string; min: number; max: number }[] = [
    { label: "1 compra", min: 1, max: 1 },
    { label: "2 compras", min: 2, max: 2 },
    { label: "3-5 compras", min: 3, max: 5 },
    { label: "6-10 compras", min: 6, max: 10 },
    { label: "11+ compras", min: 11, max: Infinity },
  ];

  const total = customers.length;
  return buckets.map((b) => {
    const count = customers.filter((c) => c.orders >= b.min && c.orders <= b.max).length;
    return {
      label: b.label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

function computeChannelAttribution(orders: MagazordOrder[]): ChannelAttribution[] {
  const channelMap = new Map<string, { orders: number; revenue: number }>();
  for (const order of orders) {
    const channel = order.lojaDoMarketplaceNome || order.formaRecebimentoNome || "Direto";
    const val = parseFloat(order.valorTotal) || 0;
    const existing = channelMap.get(channel) ?? { orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += val;
    channelMap.set(channel, existing);
  }

  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.valorTotal) || 0), 0);

  return Array.from(channelMap.entries())
    .map(([channel, data]) => ({
      channel,
      orders: data.orders,
      revenue: Math.round(data.revenue * 100) / 100,
      avgTicket: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------- V2 Computations ----------

function computeGeo(orders: MagazordOrder[]): GeoRow[] {
  const ufOrders = new Map<string, { orders: number; revenue: number; customers: Set<string> }>();
  for (const o of orders) {
    const uf = o.estadoSigla || "N/A";
    const val = parseFloat(o.valorTotal) || 0;
    const existing = ufOrders.get(uf) ?? { orders: 0, revenue: 0, customers: new Set<string>() };
    existing.orders++;
    existing.revenue += val;
    existing.customers.add(o.pessoaCpfCnpj);
    ufOrders.set(uf, existing);
  }

  // repurchase per UF
  const ufCustomerOrders = new Map<string, Map<string, number>>();
  for (const o of orders) {
    const uf = o.estadoSigla || "N/A";
    const map = ufCustomerOrders.get(uf) ?? new Map<string, number>();
    map.set(o.pessoaCpfCnpj, (map.get(o.pessoaCpfCnpj) ?? 0) + 1);
    ufCustomerOrders.set(uf, map);
  }

  return Array.from(ufOrders.entries())
    .map(([uf, d]) => {
      const custMap = ufCustomerOrders.get(uf)!;
      const total = custMap.size;
      const repeat = Array.from(custMap.values()).filter((v) => v >= 2).length;
      return {
        uf,
        orders: d.orders,
        revenue: Math.round(d.revenue * 100) / 100,
        customers: d.customers.size,
        avgTicket: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0,
        repurchaseRate: total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 27);
}

function computePaymentMethods(orders: MagazordOrder[]): PaymentMethodRow[] {
  const methodMap = new Map<string, { orders: number; revenue: number; customers: Map<string, number> }>();
  for (const o of orders) {
    const method = o.formaPagamentoNome || "Outros";
    const val = parseFloat(o.valorTotal) || 0;
    const existing = methodMap.get(method) ?? { orders: 0, revenue: 0, customers: new Map<string, number>() };
    existing.orders++;
    existing.revenue += val;
    existing.customers.set(o.pessoaCpfCnpj, (existing.customers.get(o.pessoaCpfCnpj) ?? 0) + 1);
    methodMap.set(method, existing);
  }

  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.valorTotal) || 0), 0);

  return Array.from(methodMap.entries())
    .map(([method, d]) => {
      const total = d.customers.size;
      const repeat = Array.from(d.customers.values()).filter((v) => v >= 2).length;
      return {
        method,
        orders: d.orders,
        revenue: Math.round(d.revenue * 100) / 100,
        avgTicket: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0,
        percentage: totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 1000) / 10 : 0,
        repurchaseRate: total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function computeDiscountImpact(orders: MagazordOrder[]): DiscountImpact {
  const withDisc = orders.filter((o) => parseFloat(o.valorDesconto) > 0);
  const withoutDisc = orders.filter((o) => !parseFloat(o.valorDesconto));

  function stats(subset: MagazordOrder[]) {
    const revenue = subset.reduce((s, o) => s + (parseFloat(o.valorTotal) || 0), 0);
    const custOrders = new Map<string, number>();
    for (const o of subset) custOrders.set(o.pessoaCpfCnpj, (custOrders.get(o.pessoaCpfCnpj) ?? 0) + 1);
    const total = custOrders.size;
    const repeat = Array.from(custOrders.values()).filter((v) => v >= 2).length;
    return {
      orders: subset.length,
      revenue: Math.round(revenue * 100) / 100,
      avgTicket: subset.length > 0 ? Math.round((revenue / subset.length) * 100) / 100 : 0,
      repurchaseRate: total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0,
    };
  }

  const wd = stats(withDisc);
  const wod = stats(withoutDisc);
  const lift = wod.repurchaseRate > 0 ? Math.round(((wd.repurchaseRate - wod.repurchaseRate) / wod.repurchaseRate) * 1000) / 10 : 0;

  return { withDiscount: wd, withoutDiscount: wod, discountLift: lift };
}

function computeTimeToRepurchase(customers: CustomerAgg[]): TimeToRepurchase {
  const gaps: number[] = [];
  for (const c of customers) {
    if (c.orderDates.length < 2) continue;
    const sorted = [...c.orderDates].sort((a, b) => a.getTime() - b.getTime());
    // time between 1st and 2nd purchase
    const gap = daysBetween(sorted[0], sorted[1]);
    gaps.push(gap);
  }

  if (gaps.length === 0) {
    return { medianDays: 0, avgDays: 0, buckets: [] };
  }

  gaps.sort((a, b) => a - b);
  const medianDays = gaps[Math.floor(gaps.length / 2)];
  const avgDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);

  const bucketDefs = [
    { label: "0-7 dias", min: 0, max: 7 },
    { label: "8-14 dias", min: 8, max: 14 },
    { label: "15-30 dias", min: 15, max: 30 },
    { label: "31-60 dias", min: 31, max: 60 },
    { label: "61-90 dias", min: 61, max: 90 },
    { label: "90+ dias", min: 91, max: Infinity },
  ];

  const buckets = bucketDefs.map((b) => {
    const count = gaps.filter((g) => g >= b.min && g <= b.max).length;
    return {
      label: b.label,
      count,
      percentage: Math.round((count / gaps.length) * 1000) / 10,
    };
  });

  return { medianDays, avgDays, buckets };
}

function computeProductAffinity(orders: MagazordOrder[]): ProductAffinityPair[] {
  // Product affinity requires item-level data (only available from detail endpoint)
  const pairMap = new Map<string, { skuA: string; nomeA: string; skuB: string; nomeB: string; coOccurrences: number }>();

  for (const order of orders) {
    const items = order.itens ?? [];
    if (items.length === 0) continue;
    if (items.length < 2) continue;
    const unique = Array.from(new Map(items.map((it) => [it.sku, it])).values());
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const [a, b] = unique[i].sku < unique[j].sku ? [unique[i], unique[j]] : [unique[j], unique[i]];
        const key = `${a.sku}|${b.sku}`;
        const existing = pairMap.get(key);
        if (existing) {
          existing.coOccurrences++;
        } else {
          pairMap.set(key, { skuA: a.sku, nomeA: a.nome, skuB: b.sku, nomeB: b.nome, coOccurrences: 1 });
        }
      }
    }
  }

  return Array.from(pairMap.values())
    .sort((a, b) => b.coOccurrences - a.coOccurrences)
    .slice(0, 10);
}

function computePareto(customers: CustomerAgg[]): ParetoData {
  if (customers.length === 0) return { pct80Revenue: 0, curve: [] };

  const sorted = [...customers].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((s, c) => s + c.revenue, 0);
  const totalCustomers = sorted.length;

  // Find % of customers generating 80% revenue
  let cumRevenue = 0;
  let pct80Idx = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumRevenue += sorted[i].revenue;
    if (cumRevenue >= totalRevenue * 0.8) {
      pct80Idx = i + 1;
      break;
    }
  }
  const pct80Revenue = Math.round((pct80Idx / totalCustomers) * 1000) / 10;

  // Build curve (10 points)
  const curve: { customerPct: number; revenuePct: number }[] = [];
  cumRevenue = 0;
  const step = Math.max(1, Math.floor(totalCustomers / 10));
  for (let i = 0; i < totalCustomers; i++) {
    cumRevenue += sorted[i].revenue;
    if ((i + 1) % step === 0 || i === totalCustomers - 1) {
      curve.push({
        customerPct: Math.round(((i + 1) / totalCustomers) * 1000) / 10,
        revenuePct: Math.round((cumRevenue / totalRevenue) * 1000) / 10,
      });
    }
  }

  return { pct80Revenue, curve };
}

function computeCustomersByAction(orders: MagazordOrder[]): CustomersByActionMonth[] {
  // Sort orders chronologically
  const sorted = [...orders].sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  // Track each customer's previous order date (globally, across all months)
  const customerLastOrder = new Map<string, Date>();

  // Build month buckets
  const monthData = new Map<string, { retidos: number; reativados: number; recuperados: number; novos: number }>();

  for (const order of sorted) {
    const cpf = order.pessoaCpfCnpj;
    if (!cpf) continue;
    const dt = new Date(order.dataHora);
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;

    if (!monthData.has(monthKey)) {
      monthData.set(monthKey, { retidos: 0, reativados: 0, recuperados: 0, novos: 0 });
    }
    const bucket = monthData.get(monthKey)!;

    const prevDate = customerLastOrder.get(cpf);
    if (!prevDate) {
      bucket.novos++;
    } else {
      const gap = daysBetween(prevDate, dt);
      if (gap < 60) {
        bucket.retidos++;
      } else if (gap <= 90) {
        bucket.reativados++;
      } else {
        bucket.recuperados++;
      }
    }

    // Only update last order if this is a later date (handles multiple orders same day)
    if (!prevDate || dt > prevDate) {
      customerLastOrder.set(cpf, dt);
    }
  }

  // Deduplicate: count each customer only once per month (first action wins)
  // Re-do with per-month customer tracking
  const monthCustomerAction = new Map<string, Map<string, string>>();

  // Reset and redo properly
  customerLastOrder.clear();
  for (const order of sorted) {
    const cpf = order.pessoaCpfCnpj;
    if (!cpf) continue;
    const dt = new Date(order.dataHora);
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;

    if (!monthCustomerAction.has(monthKey)) {
      monthCustomerAction.set(monthKey, new Map());
    }
    const monthCusts = monthCustomerAction.get(monthKey)!;

    // Only classify once per customer per month
    if (!monthCusts.has(cpf)) {
      const prevDate = customerLastOrder.get(cpf);
      if (!prevDate) {
        monthCusts.set(cpf, "novos");
      } else {
        const gap = daysBetween(prevDate, dt);
        if (gap < 60) monthCusts.set(cpf, "retidos");
        else if (gap <= 90) monthCusts.set(cpf, "reativados");
        else monthCusts.set(cpf, "recuperados");
      }
    }

    if (!customerLastOrder.has(cpf) || dt > customerLastOrder.get(cpf)!) {
      customerLastOrder.set(cpf, dt);
    }
  }

  return Array.from(monthCustomerAction.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, custs]) => {
      let retidos = 0, reativados = 0, recuperados = 0, novos = 0;
      for (const action of custs.values()) {
        if (action === "retidos") retidos++;
        else if (action === "reativados") reativados++;
        else if (action === "recuperados") recuperados++;
        else novos++;
      }
      return { month, retidos, reativados, recuperados, novos };
    });
}

function computeActiveCustomers(orders: MagazordOrder[]): ActiveCustomersMonth[] {
  if (orders.length === 0) return [];

  // Find the range of months in the data
  const dates = orders.map((o) => new Date(o.dataHora));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Build list of months to compute
  const months: { year: number; month: number; key: string }[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= end) {
    months.push({
      year: cur.getFullYear(),
      month: cur.getMonth(),
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  // For each month, count unique customers with an order in the 90 days before month start
  const result: ActiveCustomersMonth[] = [];
  for (const m of months) {
    const monthStart = new Date(m.year, m.month, 1);
    const lookback = new Date(monthStart);
    lookback.setDate(lookback.getDate() - 90);

    const activeSet = new Set<string>();
    for (const o of orders) {
      const dt = new Date(o.dataHora);
      if (dt >= lookback && dt < monthStart && o.pessoaCpfCnpj) {
        activeSet.add(o.pessoaCpfCnpj);
      }
    }
    result.push({ month: m.key, active: activeSet.size });
  }

  return result;
}

function emptyAnalytics(): CRMAnalytics {
  return {
    summary: {
      totalCustomers: 0, totalOrders: 0, totalRevenue: 0,
      avgTicket: 0, repurchaseRate: 0, avgLTV: 0, churn90d: 0,
    },
    rfmDistribution: [],
    topCustomers: [],
    cohorts: [],
    repurchaseBySku: [],
    frequencyBuckets: [],
    channelAttribution: [],
    geo: [],
    paymentMethods: [],
    discountImpact: {
      withDiscount: { orders: 0, revenue: 0, avgTicket: 0, repurchaseRate: 0 },
      withoutDiscount: { orders: 0, revenue: 0, avgTicket: 0, repurchaseRate: 0 },
      discountLift: 0,
    },
    timeToRepurchase: { medianDays: 0, avgDays: 0, buckets: [] },
    productAffinity: [],
    pareto: { pct80Revenue: 0, curve: [] },
    customersByAction: [],
    activeCustomers: [],
  };
}
