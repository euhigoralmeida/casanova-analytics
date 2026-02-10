import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { fetchAllSkuMetrics, fetchAccountTotals } from "@/lib/queries";

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

// Dados extras por SKU que não vêm do Google Ads
const skuExtras: Record<string, { nome: string; marginPct: number; stock: number; ecomPrice: number; mlPrice: number; mlSales: number }> = {
  "27290BR-CP": { nome: "Torneira Cozinha CP", marginPct: 35, stock: 42, ecomPrice: 279.90, mlPrice: 289.90, mlSales: 31 },
  "31450BR-LX": { nome: "Ducha Luxo LX", marginPct: 22, stock: 6, ecomPrice: 349.90, mlPrice: 329.90, mlSales: 18 },
  "19820BR-ST": { nome: "Misturador ST", marginPct: 28, stock: 18, ecomPrice: 199.90, mlPrice: 209.90, mlSales: 22 },
};

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

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
          ml: {
            price: extras?.mlPrice ?? 0,
            ecomPrice: extras?.ecomPrice ?? 0,
            mlSales: extras?.mlSales ?? 0,
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
          revenueTarget: 150000,
          revenueActual: Math.round(accountTotals.revenue * 100) / 100,
          adsActual: accountTotals.costBRL,
          roasTarget: 7,
          roasActual: acctRoas,
          marginTarget: 25,
          marginActual,
        },
        skus,
      });
    } catch (err) {
      console.error("Google Ads API error in overview, falling back to mock:", err);
    }
  }

  /* ---- MOCK (fallback) ---- */
  return NextResponse.json(buildMockOverview(period));
}

function buildMockOverview(period: string) {
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
      revenueTarget: 150000,
      revenueActual: totalRevenue,
      roasTarget: 7,
      roasActual,
      marginTarget: 25,
      marginActual,
    },
    skus,
  };
}
