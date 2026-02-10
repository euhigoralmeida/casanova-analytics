import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { fetchAllCampaignMetrics } from "@/lib/queries";

/* =========================
   Mock data (fallback)
========================= */

function buildMockCampaigns() {
  return [
    {
      campaignId: "1",
      campaignName: "Shopping - Torneiras",
      channelType: "SHOPPING",
      status: "ENABLED",
      impressions: 45000,
      clicks: 1200,
      costBRL: 89.5,
      conversions: 3.2,
      revenue: 950,
      roas: 10.61,
      cpa: 27.97,
      cpc: 0.07,
      ctr: 2.67,
    },
    {
      campaignId: "2",
      campaignName: "PMax - Metais Sanitários",
      channelType: "PERFORMANCE_MAX",
      status: "ENABLED",
      impressions: 120000,
      clicks: 3400,
      costBRL: 65.3,
      conversions: 2.1,
      revenue: 420,
      roas: 6.43,
      cpa: 31.1,
      cpc: 0.02,
      ctr: 2.83,
    },
    {
      campaignId: "3",
      campaignName: "Search - Marca",
      channelType: "SEARCH",
      status: "PAUSED",
      impressions: 8000,
      clicks: 600,
      costBRL: 25.2,
      conversions: 1.5,
      revenue: 280,
      roas: 11.11,
      cpa: 16.8,
      cpc: 0.04,
      ctr: 7.5,
    },
  ];
}

/* =========================
   GET handler
========================= */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "7d";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (isConfigured()) {
    try {
      const customer = getCustomer();
      const allCampaigns = await fetchAllCampaignMetrics(customer, period, startDate, endDate);

      const campaigns = allCampaigns
        .filter((c) => c.costBRL > 0 || c.impressions > 0)
        .map((c) => {
          const roas = c.costBRL > 0 ? Math.round((c.revenue / c.costBRL) * 100) / 100 : 0;
          const cpa = c.conversions > 0 ? Math.round((c.costBRL / c.conversions) * 100) / 100 : 0;
          const cpc = c.clicks > 0 ? Math.round((c.costBRL / c.clicks) * 100) / 100 : 0;
          const ctr = c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0;

          return {
            ...c,
            roas,
            cpa,
            cpc,
            ctr,
          };
        });

      return NextResponse.json({
        period,
        source: "google-ads",
        updatedAt: new Date().toISOString(),
        campaigns,
      });
    } catch (err) {
      console.error("Google Ads API error in campaigns:", err);
    }
  }

  return NextResponse.json({
    period,
    source: "mock",
    updatedAt: new Date().toISOString(),
    campaigns: buildMockCampaigns(),
  });
}
