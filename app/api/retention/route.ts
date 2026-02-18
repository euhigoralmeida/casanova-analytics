import { NextRequest, NextResponse } from "next/server";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchCohortRetention, fetchRetentionSummary, fetchUserLifetimeValue } from "@/lib/ga4-queries";
import type { RetentionData } from "@/lib/ga4-queries";
import { requireAuth } from "@/lib/api-helpers";

/* =========================
   Mock data for when GA4 is not configured
========================= */

function generateMockData(): RetentionData {
  return {
    source: "not_configured",
    summary: {
      totalUsers: 4820,
      newUsers: 3290,
      returningUsers: 1530,
      returnRate: 31.74,
      avgSessionsPerUser: 2.4,
      purchases: 312,
      purchasers: 195,
      revenue: 89450.0,
      avgOrderValue: 286.7,
      repurchaseEstimate: 1.65,
    },
    cohorts: [
      { cohortWeek: "Semana 1", usersStart: 680, retention: [100, 38, 24, 16, 12, 9, 7, 5, 4] },
      { cohortWeek: "Semana 2", usersStart: 720, retention: [100, 41, 27, 19, 14, 10, 8, 6, 0] },
      { cohortWeek: "Semana 3", usersStart: 650, retention: [100, 35, 22, 15, 11, 8, 6, 0, 0] },
      { cohortWeek: "Semana 4", usersStart: 710, retention: [100, 40, 26, 18, 13, 9, 0, 0, 0] },
      { cohortWeek: "Semana 5", usersStart: 690, retention: [100, 37, 23, 16, 11, 0, 0, 0, 0] },
      { cohortWeek: "Semana 6", usersStart: 740, retention: [100, 42, 28, 20, 0, 0, 0, 0, 0] },
      { cohortWeek: "Semana 7", usersStart: 660, retention: [100, 36, 22, 0, 0, 0, 0, 0, 0] },
      { cohortWeek: "Semana 8", usersStart: 700, retention: [100, 39, 0, 0, 0, 0, 0, 0, 0] },
    ],
    channelLTV: [
      { channel: "Paid Shopping", users: 1240, purchasers: 92, revenue: 42800, purchases: 148, revenuePerUser: 34.52, revenuePerPurchaser: 465.22, purchasesPerUser: 0.12, avgTicket: 289.19 },
      { channel: "Organic Search", users: 1580, purchasers: 48, revenue: 21300, purchases: 78, revenuePerUser: 13.48, revenuePerPurchaser: 443.75, purchasesPerUser: 0.05, avgTicket: 273.08 },
      { channel: "Direct", users: 820, purchasers: 28, revenue: 12400, purchases: 42, revenuePerUser: 15.12, revenuePerPurchaser: 442.86, purchasesPerUser: 0.05, avgTicket: 295.24 },
      { channel: "Paid Search", users: 450, purchasers: 16, revenue: 7200, purchases: 24, revenuePerUser: 16.0, revenuePerPurchaser: 450.0, purchasesPerUser: 0.05, avgTicket: 300.0 },
      { channel: "Organic Social", users: 380, purchasers: 8, revenue: 3800, purchases: 12, revenuePerUser: 10.0, revenuePerPurchaser: 475.0, purchasesPerUser: 0.03, avgTicket: 316.67 },
      { channel: "Email", users: 350, purchasers: 6, revenue: 1950, purchases: 8, revenuePerUser: 5.57, revenuePerPurchaser: 325.0, purchasesPerUser: 0.02, avgTicket: 243.75 },
    ],
  };
}

/* =========================
   GET /api/retention
========================= */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  if (!isGA4Configured()) {
    return NextResponse.json(generateMockData(), { status: 200 });
  }

  try {
    const client = getGA4Client();

    const [cohorts, summary, channelLTV] = await Promise.all([
      fetchCohortRetention(client, startDate, endDate),
      fetchRetentionSummary(client, startDate, endDate),
      fetchUserLifetimeValue(client, startDate, endDate),
    ]);

    const result: RetentionData = {
      source: "ga4",
      updatedAt: new Date().toISOString(),
      summary,
      cohorts,
      channelLTV,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Retention API error:", err);
    return NextResponse.json({ source: "error", error: "Erro interno ao buscar dados de retenção" }, { status: 500 });
  }
}
