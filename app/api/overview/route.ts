import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { fetchAllSkuMetrics, fetchAccountTotals } from "@/lib/queries";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { computeTargetMonth } from "@/lib/planning-target-calc";
import { loadSkuExtras } from "@/lib/sku-master";

/* =========================
   Mock data (fallback)
========================= */

const periodMultiplier: Record<string, number> = {
  "7d": 1,
  "14d": 2,
  "30d": 4.3,
  "60d": 8.6,
};

type SkuData = {
  nome: string;
  revenue: number;
  ads: number;
  purchases: number;
  marginPct: number;
  stock: number;
  ecomPrice: number;
  mlPrice: number;
  mlSales: number;
};

const catalog: Record<string, SkuData> = {
  "27290BR-CP": {
    nome: "Torneira Cozinha CP",
    revenue: 18400, ads: 2240, purchases: 56, marginPct: 35,
    stock: 42, ecomPrice: 279.90, mlPrice: 289.90, mlSales: 31,
  },
  "31450BR-LX": {
    nome: "Ducha Luxo LX",
    revenue: 9200, ads: 2240, purchases: 24, marginPct: 22,
    stock: 6, ecomPrice: 349.90, mlPrice: 329.90, mlSales: 18,
  },
  "19820BR-ST": {
    nome: "Misturador ST",
    revenue: 12600, ads: 2100, purchases: 35, marginPct: 28,
    stock: 18, ecomPrice: 199.90, mlPrice: 209.90, mlSales: 22,
  },
};

// Dados extras por SKU agora vêm do banco (SkuMaster) via loadSkuExtras()

function deriveStatus(roas: number, cpa: number, marginPct: number, stock: number, conversions: number): "escalar" | "manter" | "pausar" {
  // SKUs sem conversões mas com ROAS alto (receita orgânica?) → manter
  if (conversions === 0 && roas === 0) return "pausar";
  if (roas < 5 || cpa > 80) return "pausar";
  if (roas < 7 || marginPct < 25) return "manter";
  if (stock > 20) return "escalar";
  return "manter";
}

// Sem limite — paginação feita no frontend

/* =========================
   GET handler
========================= */

type PlanningTargets = {
  revenueTarget: number;       // Receita Faturada target
  revenueCaptadaTarget: number; // Receita Captada necessária
  roasTarget: number;          // ROAS Captado target
  roasFaturadoTarget: number;  // ROAS Faturado target
  marginTarget: number;
  adsTarget: number;           // Investimento Total planejado
  approvalRate: number;        // % Aprovação Receita
};

async function getPlanningTargets(tenantId: string): Promise<PlanningTargets> {
  const defaults: PlanningTargets = { revenueTarget: 150000, revenueCaptadaTarget: 0, roasTarget: 7, roasFaturadoTarget: 0, marginTarget: 25, adsTarget: 0, approvalRate: 0 };
  try {
    const now = new Date();
    const rows = await prisma.planningEntry.findMany({
      where: { tenantId, year: now.getFullYear(), month: now.getMonth() + 1, planType: "target" },
    });
    if (rows.length === 0) return defaults;

    const inputs: Record<string, number> = {};
    for (const r of rows) inputs[r.metric] = r.value;
    const calc = computeTargetMonth(inputs);
    const all = { ...inputs, ...calc };

    return {
      revenueTarget: all.receita_faturada ?? defaults.revenueTarget,
      revenueCaptadaTarget: all.receita_captada ?? 0,
      roasTarget: all.roas_captado ?? defaults.roasTarget,
      roasFaturadoTarget: all.roas_faturado ?? 0,
      marginTarget: defaults.marginTarget,
      adsTarget: all.investimento_total ?? 0,
      approvalRate: all.pct_aprovacao_receita ?? 0,
    };
  } catch {
    return defaults;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = auth.session.tenantId;

  const [targets, skuExtras] = await Promise.all([
    getPlanningTargets(tenantId),
    loadSkuExtras(tenantId),
  ]);

  /* ---- DADOS REAIS (Google Ads) ---- */
  if (isConfigured()) {
    try {
      const customer = getCustomer();
      const [allSkus, accountTotals] = await Promise.all([
        fetchAllSkuMetrics(customer, period, startDate, endDate),
        fetchAccountTotals(customer, period, startDate, endDate),
      ]);

      let totalRevenue = 0;
      let totalAds = 0;
      let marginSum = 0;
      let marginCount = 0;

      // Calcular totais com TODOS os SKUs (para metas), mas limitar lista
      const allProcessed = allSkus.map((data) => {
        const extras = skuExtras[data.sku];
        const marginPct = extras?.marginPct ?? 30;
        const stock = extras?.stock ?? 0;

        const revenue = Math.round(data.revenue * 100) / 100;
        const ads = Math.round(data.costBRL * 100) / 100;
        const purchases = data.conversions;
        const roas = ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0;
        const cpa = purchases > 0 ? Math.round((ads / purchases) * 100) / 100 : 0;

        totalRevenue += revenue;
        totalAds += ads;
        marginSum += marginPct;
        marginCount++;

        const impressions = data.impressions;
        const clicks = data.clicks;
        const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

        return {
          sku: data.sku,
          nome: extras?.nome ?? data.title,
          revenue,
          ads,
          roas,
          cpa,
          marginPct,
          stock,
          impressions,
          clicks,
          ctr,
          conversions: purchases,
          status: deriveStatus(roas, cpa, marginPct, stock, purchases),
          campaignStatus: data.campaignStatus,
          ml: {
            price: 0,
            ecomPrice: 0,
            mlSales: 0,
          },
        };
      });

      // Todos os SKUs ordenados por receita (paginação no frontend)
      const skus = allProcessed;

      const marginActual = marginCount > 0 ? +(marginSum / marginCount).toFixed(1) : 0;

      // Usar totais da conta (campaign-level) para metas — captura TODOS os tipos de campanha
      const acctRoas = accountTotals.costBRL > 0 ? +(accountTotals.revenue / accountTotals.costBRL).toFixed(2) : 0;

      return NextResponse.json({
        period,
        source: "google-ads",
        updatedAt: new Date().toISOString(),
        totalSkus: allSkus.length,
        accountTotals: {
          ads: accountTotals.costBRL,
          impressions: accountTotals.impressions,
          clicks: accountTotals.clicks,
          conversions: accountTotals.conversions,
          revenue: accountTotals.revenue,
        },
        shoppingTotals: {
          ads: Math.round(totalAds * 100) / 100,
          revenue: Math.round(totalRevenue * 100) / 100,
        },
        meta: {
          revenueTarget: targets.revenueTarget,
          revenueCaptadaTarget: targets.revenueCaptadaTarget,
          revenueActual: Math.round(accountTotals.revenue * 100) / 100,
          adsTarget: targets.adsTarget,
          adsActual: accountTotals.costBRL,
          roasTarget: targets.roasTarget,
          roasFaturadoTarget: targets.roasFaturadoTarget,
          roasActual: acctRoas,
          marginTarget: targets.marginTarget,
          marginActual,
          approvalRate: targets.approvalRate,
        },
        skus,
      });
    } catch (err) {
      console.error("Google Ads API error in overview, falling back to mock:", err);
    }
  }

  /* ---- MOCK (fallback) ---- */
  return NextResponse.json(buildMockOverview(period, targets));
}

function buildMockOverview(period: string, targets: { revenueTarget: number; roasTarget: number; marginTarget: number }) {
  const m = periodMultiplier[period] ?? 1;

  let totalRevenue = 0;
  let totalAds = 0;
  let marginSum = 0;

  const skus = Object.entries(catalog).map(([sku, data]) => {
    const revenue = Math.round(data.revenue * m);
    const ads = Math.round(data.ads * m);
    const purchases = Math.round(data.purchases * m);
    const roas = +(revenue / ads).toFixed(2);
    const cpa = +(ads / purchases).toFixed(2);

    totalRevenue += revenue;
    totalAds += ads;
    marginSum += data.marginPct;

    const impressions = Math.round(purchases * 350 * m);
    const clicks = Math.round(purchases * 18 * m);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

    return {
      sku,
      nome: data.nome,
      revenue,
      ads,
      roas,
      cpa,
      marginPct: data.marginPct,
      stock: data.stock,
      impressions,
      clicks,
      ctr,
      conversions: purchases,
      status: deriveStatus(roas, cpa, data.marginPct, data.stock, purchases),
      campaignStatus: "ENABLED" as const,
      ml: {
        price: data.mlPrice,
        ecomPrice: data.ecomPrice,
        mlSales: Math.round(data.mlSales * m),
      },
    };
  });

  const skuCount = Object.keys(catalog).length;
  const roasActual = +(totalRevenue / totalAds).toFixed(2);
  const marginActual = +(marginSum / skuCount).toFixed(1);

  return {
    period,
    source: "mock",
    updatedAt: new Date().toISOString(),
    totalSkus: skuCount,
    meta: {
      revenueTarget: targets.revenueTarget,
      revenueActual: totalRevenue,
      roasTarget: targets.roasTarget,
      roasActual,
      marginTarget: targets.marginTarget,
      marginActual,
    },
    skus,
  };
}
