import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { fetchSkuTimeSeries, fetchAllTimeSeries, fetchAccountTimeSeries, fetchCampaignTimeSeries, DailyMetrics } from "@/lib/queries";

/* =========================
   Mock data (fallback)
========================= */

function generateMockTimeSeries(days: number, sku?: string): DailyMetrics[] {
  const data: DailyMetrics[] = [];
  const baseRevenue = sku ? 2600 : 5700;
  const baseCost = sku ? 320 : 940;
  const baseImpressions = sku ? 10000 : 24000;
  const baseClicks = sku ? 580 : 1300;
  const baseConversions = sku ? 8 : 16;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    // Simular variação: fins de semana mais fracos, meio da semana mais forte
    const weekdayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.65 : dayOfWeek === 3 ? 1.2 : 1.0;
    // Ruído aleatório determinístico baseado no dia
    const noise = 0.8 + (((i * 7 + 13) % 20) / 20) * 0.4;
    const factor = weekdayFactor * noise;

    data.push({
      date: d.toISOString().slice(0, 10),
      impressions: Math.round(baseImpressions * factor),
      clicks: Math.round(baseClicks * factor),
      costBRL: Math.round(baseCost * factor * 100) / 100,
      conversions: Math.round(baseConversions * factor),
      revenue: Math.round(baseRevenue * factor * 100) / 100,
    });
  }

  return data;
}

function getDaysFromPeriod(period: string, startDate?: string, endDate?: string): number {
  if (startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }
  const map: Record<string, number> = {
    today: 1,
    yesterday: 1,
    "7d": 7,
    "14d": 14,
    "30d": 30,
    this_month: new Date().getDate(),
    last_month: new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate(),
    "60d": 60,
    "90d": 90,
  };
  return map[period] ?? 7;
}

/* =========================
   GET handler
========================= */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const sku = searchParams.get("sku") ?? undefined;
  const scope = searchParams.get("scope") ?? "sku"; // "sku" | "all" | "account" | "campaign"
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  /* ---- DADOS REAIS (Google Ads) ---- */
  if (isConfigured()) {
    try {
      const customer = getCustomer();

      let daily: DailyMetrics[];
      if (scope === "campaign" && campaignId) {
        daily = await fetchCampaignTimeSeries(customer, campaignId, period, startDate, endDate);
      } else if (scope === "account") {
        daily = await fetchAccountTimeSeries(customer, period, startDate, endDate);
      } else if (scope === "all") {
        daily = await fetchAllTimeSeries(customer, period, startDate, endDate);
      } else {
        daily = await fetchSkuTimeSeries(customer, sku ?? "", period, startDate, endDate);
      }

      // Calcular métricas derivadas por dia
      const series = daily.map((d) => ({
        date: d.date,
        revenue: Math.round(d.revenue * 100) / 100,
        cost: Math.round(d.costBRL * 100) / 100,
        roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
        conversions: Math.round(d.conversions),
        impressions: d.impressions,
        clicks: d.clicks,
        cpc: d.clicks > 0 ? Math.round((d.costBRL / d.clicks) * 100) / 100 : 0,
        ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      }));

      return NextResponse.json({
        scope,
        sku: scope === "sku" ? sku : undefined,
        period,
        source: "google-ads",
        series,
      });
    } catch (err) {
      console.error("Google Ads API error in timeseries, falling back to mock:", err);
    }
  }

  /* ---- MOCK (fallback) ---- */
  const days = getDaysFromPeriod(period, startDate, endDate);
  const mockDaily = generateMockTimeSeries(days, scope === "sku" ? sku : undefined);

  const series = mockDaily.map((d) => ({
    date: d.date,
    revenue: d.revenue,
    cost: d.costBRL,
    roas: d.costBRL > 0 ? Math.round((d.revenue / d.costBRL) * 100) / 100 : 0,
    conversions: d.conversions,
    impressions: d.impressions,
    clicks: d.clicks,
    cpc: d.clicks > 0 ? Math.round((d.costBRL / d.clicks) * 100) / 100 : 0,
    ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
  }));

  return NextResponse.json({
    scope,
    sku: scope === "sku" ? sku : undefined,
    period,
    source: "mock",
    series,
  });
}
