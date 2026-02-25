import { NextRequest, NextResponse } from "next/server";
import { fetchClarityFromApi, saveClarityToDB, getClarityFromDB } from "@/lib/clarity";
import { prisma } from "@/lib/db";

/* =========================
   GET /api/cron/clarity
   Vercel Cron job — daily Clarity data refresh for ALL active tenants.
   Protected by CRON_SECRET (Bearer token).
========================= */

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const numDays = 3;

  // Get all active tenants from DB, fallback to "default" if DB unavailable
  let tenantIds: string[] = ["default"];
  try {
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { id: true },
    });
    if (tenants.length > 0) {
      tenantIds = tenants.map((t) => t.id);
    }
  } catch {
    console.warn("Cron clarity: could not fetch tenants from DB, using default");
  }

  const results: Record<string, unknown> = {};

  for (const tenantId of tenantIds) {
    try {
      const { data, apiCalls } = await fetchClarityFromApi(numDays, tenantId);

      if (data.source === "not_configured") {
        results[tenantId] = { status: "skipped", reason: "not_configured" };
        continue;
      }

      if (data.source === "clarity" && data.behavioral.totalTraffic > 0) {
        await saveClarityToDB(data, tenantId, numDays, apiCalls);
        results[tenantId] = {
          status: "success",
          apiCalls,
          traffic: data.behavioral.totalTraffic,
          pages: data.pageAnalysis.length,
        };
        continue;
      }

      const existing = await getClarityFromDB(tenantId, numDays);
      results[tenantId] = {
        status: "no_data",
        existingDataAge: existing ? existing.fetchedAt.toISOString() : null,
        apiCalls,
      };
    } catch (err) {
      const errMsg = String(err);
      console.error(`Cron clarity error for tenant ${tenantId}:`, errMsg);
      results[tenantId] = {
        status: "error",
        reason: errMsg.includes("429") ? "Rate limited (429)" : errMsg.slice(0, 200),
      };
    }
  }

  return NextResponse.json({
    tenantsProcessed: tenantIds.length,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
