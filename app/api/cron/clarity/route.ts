import { NextRequest, NextResponse } from "next/server";
import { fetchClarityFromApi, saveClarityToDB, getClarityFromDB } from "@/lib/clarity";

/* =========================
   GET /api/cron/clarity
   Vercel Cron job — daily Clarity data refresh.
   Protected by CRON_SECRET (Bearer token).
========================= */

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = "default";
  const numDays = 3;

  try {
    const { data, apiCalls } = await fetchClarityFromApi(numDays);

    if (data.source === "not_configured") {
      return NextResponse.json({
        status: "skipped",
        reason: "Clarity not configured (missing CLARITY_PROJECT_ID or CLARITY_API_TOKEN)",
      });
    }

    if (data.source === "clarity" && data.behavioral.totalTraffic > 0) {
      // Success — save to DB
      await saveClarityToDB(data, tenantId, numDays, apiCalls);
      return NextResponse.json({
        status: "success",
        apiCalls,
        traffic: data.behavioral.totalTraffic,
        pages: data.pageAnalysis.length,
        devices: data.deviceBreakdown.length,
        channels: data.channelBreakdown.length,
        fetchedAt: new Date().toISOString(),
      });
    }

    // API returned data but no traffic — don't overwrite existing good data
    const existing = await getClarityFromDB(tenantId, numDays);
    return NextResponse.json({
      status: "no_data",
      reason: "Clarity API returned no traffic data",
      existingDataAge: existing ? existing.fetchedAt.toISOString() : null,
      apiCalls,
    });
  } catch (err) {
    const errMsg = String(err);
    const isRateLimit = errMsg.includes("429");
    console.error("Cron clarity error:", errMsg);

    // On error, don't overwrite existing DB data
    const existing = await getClarityFromDB(tenantId, numDays);
    return NextResponse.json({
      status: "error",
      reason: isRateLimit ? "Rate limited (429)" : errMsg.slice(0, 200),
      existingDataPreserved: !!existing,
      existingDataAge: existing ? existing.fetchedAt.toISOString() : null,
    }, { status: isRateLimit ? 200 : 500 }); // 200 for rate limit so Vercel doesn't retry
  }
}
