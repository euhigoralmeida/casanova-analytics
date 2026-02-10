import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { fetchSkuMetrics } from "@/lib/queries";

/* =========================
   Mock data (fallback)
========================= */

const periodMultiplier: Record<string, number> = {
  "7d": 1,
  "14d": 2,
  "30d": 4.3,
  "60d": 8.6,
};

type SkuProfile = {
  revenue: number;
  ads: number;
  purchases: number;
  marginPct: number;
  stock: number;
  leadTimeDays: number;
  impressions: number;
  clicks: number;
  addToCart: number;
  checkouts: number;
};

const skuProfiles: Record<string, SkuProfile> = {
  "27290BR-CP": {
    revenue: 18400, ads: 2240, purchases: 56, marginPct: 35,
    stock: 42, leadTimeDays: 8, impressions: 72000, clicks: 4100,
    addToCart: 920, checkouts: 280,
  },
  "31450BR-LX": {
    revenue: 9200, ads: 2240, purchases: 24, marginPct: 22,
    stock: 6, leadTimeDays: 15, impressions: 45000, clicks: 2100,
    addToCart: 380, checkouts: 95,
  },
  "19820BR-ST": {
    revenue: 12600, ads: 2100, purchases: 35, marginPct: 28,
    stock: 18, leadTimeDays: 12, impressions: 54000, clicks: 2800,
    addToCart: 560, checkouts: 165,
  },
};

const defaultSku = "27290BR-CP";

/* =========================
   Alerta builder
========================= */

type Alert = { title: string; description: string; severity: "danger" | "warn" | "info" };

function buildAlerts(roas: number, cpa: number, marginPct: number, stock: number, leadTimeDays: number, profitAfterAds: number): Alert[] {
  const alerts: Alert[] = [];

  if (roas < 5) {
    alerts.push({ title: "ROAS abaixo do mínimo — considerar pausa", description: `ROAS atual: ${roas}. Threshold de pausa: 5,0. Produto pode estar queimando verba.`, severity: "danger" });
  } else if (roas < 7) {
    alerts.push({ title: "ROAS abaixo da meta", description: `ROAS atual: ${roas}. Meta mensal: 7,0. Monitorar de perto.`, severity: "warn" });
  }

  if (cpa > 80) {
    alerts.push({ title: "CPA acima do limite de pausa", description: `CPA atual: R$${cpa.toFixed(2).replace(".", ",")}. Limite: R$80,00. Considerar pausar ou otimizar.`, severity: "danger" });
  }

  if (marginPct < 25) {
    alerts.push({ title: "Margem abaixo da meta", description: `Margem atual: ${marginPct}%. Meta mínima: 25%. Lucro comprometido.`, severity: "warn" });
  }

  if (stock < 20 && leadTimeDays > 10) {
    alerts.push({ title: "Risco de ruptura de estoque", description: `Apenas ${stock} unidades com lead time de ${leadTimeDays} dias. Estoque pode não cobrir reposição.`, severity: "warn" });
  }

  if (profitAfterAds < 0) {
    alerts.push({ title: "Prejuízo após ads", description: `Lucro após ads: R$${profitAfterAds.toLocaleString("pt-BR")}. Operação no vermelho.`, severity: "danger" });
  }

  return alerts;
}

/* =========================
   GET handler
========================= */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const sku = searchParams.get("sku") ?? defaultSku;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  // Dados que não vêm do Google Ads (mock/config manual)
  const knownProfile = skuProfiles[sku];
  const marginPct = knownProfile?.marginPct ?? 30;
  const stock = knownProfile?.stock ?? 0;
  const leadTimeDays = knownProfile?.leadTimeDays ?? 10;

  /* ---- DADOS REAIS (Google Ads) ---- */
  if (isConfigured()) {
    try {
      const customer = getCustomer();
      const data = await fetchSkuMetrics(customer, sku, period, startDate, endDate);

      if (!data) {
        // SKU não tem dados Shopping neste período — retornar zeros (dados reais, não mock)
        return NextResponse.json({
          sku,
          period,
          source: "google-ads",
          skuTitle: sku,
          updatedAt: new Date().toISOString(),
          cards: { roas: 0, cpa: 0, arpur: 0, marginPct, revenue: 0, ads: 0, grossProfit: 0, profitAfterAds: 0, stock, leadTimeDays, cpc: 0, cpm: 0 },
          alerts: [],
          funnel: [
            { etapa: "Impressões", qtd: 0, taxa: 100, custo: null },
            { etapa: "Cliques", qtd: 0, taxa: 0, custo: null },
            { etapa: "Compra", qtd: 0, taxa: 0, custo: null },
          ],
        });
      }

      const revenue = Math.round(data.revenue * 100) / 100;
      const ads = Math.round(data.costBRL * 100) / 100;
      const purchases = data.conversions;
      const roas = ads > 0 ? Math.round((revenue / ads) * 100) / 100 : 0;
      const cpa = purchases > 0 ? Math.round((ads / purchases) * 100) / 100 : 0;
      const cpc = data.clicks > 0 ? Math.round((ads / data.clicks) * 100) / 100 : 0;
      const cpm = data.impressions > 0 ? Math.round((ads / data.impressions * 1000) * 100) / 100 : 0;
      const arpur = purchases > 0 ? Math.round((revenue / purchases) * 100) / 100 : 0;
      const grossProfit = Math.round(revenue * (marginPct / 100) * 100) / 100;
      const profitAfterAds = Math.round((grossProfit - ads) * 100) / 100;

      const ctrPct = data.impressions > 0 ? Math.round((data.clicks / data.impressions * 100) * 100) / 100 : 0;
      const convRate = data.clicks > 0 ? Math.round((purchases / data.clicks * 100) * 100) / 100 : 0;

      const funnel = [
        { etapa: "Impressões", qtd: data.impressions, taxa: 100, custo: null },
        { etapa: "Cliques", qtd: data.clicks, taxa: ctrPct, custo: ads },
        { etapa: "Compra", qtd: Math.round(purchases * 100) / 100, taxa: convRate, custo: cpa > 0 ? cpa : null },
      ];

      const alerts = buildAlerts(roas, cpa, marginPct, stock, leadTimeDays, profitAfterAds);

      return NextResponse.json({
        sku,
        period,
        source: "google-ads",
        skuTitle: data.title,
        updatedAt: new Date().toISOString(),
        cards: { roas, cpa, arpur, marginPct, revenue, ads, grossProfit, profitAfterAds, stock, leadTimeDays, cpc, cpm, conversions: purchases, clicks: data.clicks, convRate },
        alerts,
        funnel,
      });
    } catch (err) {
      console.error("Google Ads API error, falling back to mock:", err);
    }
  }

  /* ---- MOCK (fallback) ---- */
  return NextResponse.json(buildMockResponse(sku, period));
}

function buildMockResponse(sku: string, period: string) {
  const m = periodMultiplier[period] ?? 1;
  const knownSku = sku in skuProfiles;
  const profile = skuProfiles[sku] ?? skuProfiles[defaultSku];

  const revenue = Math.round(profile.revenue * m);
  const ads = Math.round(profile.ads * m);
  const purchases = Math.round(profile.purchases * m);
  const roas = +(revenue / ads).toFixed(2);
  const cpa = +(ads / purchases).toFixed(2);
  const marginPct = profile.marginPct;
  const grossProfit = Math.round(revenue * (marginPct / 100));
  const profitAfterAds = grossProfit - ads;
  const clicks = Math.round(profile.clicks * m);
  const impressions = Math.round(profile.impressions * m);
  const cpc = +(ads / clicks).toFixed(2);
  const cpm = +(ads / impressions * 1000).toFixed(2);

  const funnel = [
    { etapa: "Impressões", qtd: impressions, taxa: 100, custo: null },
    { etapa: "Cliques", qtd: clicks, taxa: +(clicks / impressions * 100).toFixed(1), custo: +(ads * 0.45).toFixed(2) },
    { etapa: "Add to Cart", qtd: Math.round(profile.addToCart * m), taxa: +(profile.addToCart / profile.clicks * 100).toFixed(1), custo: +(ads * 0.25).toFixed(2) },
    { etapa: "Checkout", qtd: Math.round(profile.checkouts * m), taxa: +(profile.checkouts / profile.addToCart * 100).toFixed(1), custo: +(ads * 0.18).toFixed(2) },
    { etapa: "Compra", qtd: purchases, taxa: +(profile.purchases / profile.checkouts * 100).toFixed(1), custo: +(ads * 0.12).toFixed(2) },
  ];

  const alerts = buildAlerts(roas, cpa, marginPct, profile.stock, profile.leadTimeDays, profitAfterAds);

  if (!knownSku) {
    alerts.unshift({ title: "SKU não mapeado", description: `O SKU "${sku}" não foi encontrado. Exibindo dados do SKU padrão (${defaultSku}).`, severity: "info" });
  }

  return {
    sku: knownSku ? sku : defaultSku,
    period,
    source: "mock",
    skuTitle: knownSku ? sku : defaultSku,
    updatedAt: new Date().toISOString(),
    cards: {
      roas, cpa, arpur: +(revenue / purchases).toFixed(2), marginPct,
      revenue, ads, grossProfit, profitAfterAds,
      stock: profile.stock, leadTimeDays: profile.leadTimeDays, cpc, cpm,
      conversions: purchases, clicks, convRate: clicks > 0 ? +(purchases / clicks * 100).toFixed(2) : 0,
    },
    alerts,
    funnel,
  };
}
