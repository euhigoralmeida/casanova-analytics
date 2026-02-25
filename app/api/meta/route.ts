import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import {
  fetchMetaCampaigns,
  fetchMetaAccountTotals,
  fetchMetaTimeSeries,
} from "@/lib/meta-ads";
import type { MetaAdsResponse } from "@/lib/meta-ads";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = getEffectiveTenantId(auth.session);

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    const [campaigns, accountTotals, timeSeries] = await Promise.all([
      fetchMetaCampaigns(startDate, endDate, tenantId),
      fetchMetaAccountTotals(startDate, endDate, tenantId),
      fetchMetaTimeSeries(startDate, endDate, tenantId),
    ]);

    return NextResponse.json({
      source: "meta-ads",
      updatedAt: new Date().toISOString(),
      campaigns,
      accountTotals,
      timeSeries,
    } satisfies MetaAdsResponse);
  } catch (err) {
    console.error("Meta Ads API error:", err);
    return NextResponse.json({
      source: "not_configured",
      updatedAt: new Date().toISOString(),
      campaigns: [],
    } satisfies MetaAdsResponse);
  }
}
