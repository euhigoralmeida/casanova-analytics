import { NextRequest, NextResponse } from "next/server";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchGA4FunnelTimeSeries, fetchChannelAcquisition } from "@/lib/ga4-queries";

/* =========================
   GET handler — v2
========================= */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  /* ---- GA4 não configurado ---- */
  if (!isGA4Configured()) {
    return NextResponse.json({ source: "not_configured" }, { status: 200 });
  }

  /* ---- DADOS REAIS (GA4) ---- */
  try {
    const client = getGA4Client();

    const [funnelData, summary, dailySeries, channelAcquisition] = await Promise.all([
      fetchEcommerceFunnel(client, startDate, endDate),
      fetchGA4Summary(client, startDate, endDate),
      fetchGA4FunnelTimeSeries(client, startDate, endDate),
      fetchChannelAcquisition(client, startDate, endDate),
    ]);

    const funnel = funnelData.funnel;
    const topCount = funnel[0]?.count ?? 0;
    const purchaseCount = funnel[funnel.length - 1]?.count ?? 0;
    const overallConversionRate = topCount > 0 ? Math.round((purchaseCount / topCount) * 10000) / 100 : 0;

    return NextResponse.json({
      source: "ga4",
      updatedAt: new Date().toISOString(),
      funnel,
      overallConversionRate,
      summary,
      dailySeries,
      channelAcquisition,
    });
  } catch (err) {
    console.error("GA4 API error:", err);
    return NextResponse.json({ source: "error", error: String(err) }, { status: 500 });
  }
}
