import { NextRequest, NextResponse } from "next/server";
import { getGA4ClientAsync } from "@/lib/google-analytics";
import { fetchEcommerceFunnel, fetchGA4Summary, fetchGA4FunnelTimeSeries, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { requireAuth, requireTenantContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

/* =========================
   GET handler — v2
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  /* ---- DADOS REAIS (GA4) ---- */
  try {
    const client = await getGA4ClientAsync(tenantId);
    if (!client) {
      return NextResponse.json({
        source: "not_configured",
        updatedAt: new Date().toISOString(),
      });
    }

    const [funnelData, summary, dailySeries, channelAcquisition] = await Promise.all([
      fetchEcommerceFunnel(client, startDate, endDate, tenantId),
      fetchGA4Summary(client, startDate, endDate, tenantId),
      fetchGA4FunnelTimeSeries(client, startDate, endDate, tenantId),
      fetchChannelAcquisition(client, startDate, endDate, tenantId),
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
    logger.error("GA4 API error", { route: "/api/ga4", tenantId }, err);
    return NextResponse.json({ source: "error", error: "Erro interno ao buscar dados GA4" }, { status: 500 });
  }
}
