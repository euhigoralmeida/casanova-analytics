import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import {
  isMetaAdsConfigured,
  fetchMetaCampaigns,
  fetchMetaAccountTotals,
  fetchMetaTimeSeries,
} from "@/lib/meta-ads";
import type { MetaAdsResponse } from "@/lib/meta-ads";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  if (!isMetaAdsConfigured()) {
    return NextResponse.json({
      source: "not_configured",
      updatedAt: new Date().toISOString(),
      campaigns: [],
    } satisfies MetaAdsResponse);
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    const [campaigns, accountTotals, timeSeries] = await Promise.all([
      fetchMetaCampaigns(startDate, endDate),
      fetchMetaAccountTotals(startDate, endDate),
      fetchMetaTimeSeries(startDate, endDate),
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
