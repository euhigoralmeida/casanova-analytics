import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANNING_INPUT_METRICS, PLANNING_TARGET_INPUT_METRICS } from "@/types/api";
import type { PlanningYearData } from "@/types/api";

function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Build response from DB rows, including source info */
function buildResponse(rows: { month: number; metric: string; value: number; source: string }[]) {
  const entries: PlanningYearData = {};
  const sources: Record<number, Record<string, string>> = {};
  for (const row of rows) {
    if (!entries[row.month]) entries[row.month] = {};
    entries[row.month][row.metric] = row.value;
    if (!sources[row.month]) sources[row.month] = {};
    sources[row.month][row.metric] = row.source;
  }
  return { entries, sources };
}

function parsePlanType(val: string | null): "actual" | "target" {
  return val === "target" ? "target" : "actual";
}

function getValidMetrics(planType: "actual" | "target"): Set<string> {
  return planType === "target"
    ? new Set<string>(PLANNING_TARGET_INPUT_METRICS)
    : new Set<string>(PLANNING_INPUT_METRICS);
}

/* =========================
   GET /api/planning?year=2026&planType=actual|target
========================= */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year) || year < 2020 || year > 2040) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }

  const planType = parsePlanType(req.nextUrl.searchParams.get("planType"));

  const rows = await prisma.planningEntry.findMany({
    where: { tenantId: session.tenantId, year, planType },
  });

  const { entries, sources } = buildResponse(rows);

  // Get last sync timestamp (only relevant for "actual")
  let lastSyncedAt: Date | null = null;
  if (planType === "actual") {
    const lastSync = await prisma.planningSyncLog.findFirst({
      where: { tenantId: session.tenantId, year },
      orderBy: { syncedAt: "desc" },
    });
    lastSyncedAt = lastSync?.syncedAt ?? null;
  }

  return NextResponse.json({
    year,
    planType,
    entries,
    sources,
    lastSyncedAt,
  });
}

/* =========================
   PUT /api/planning
   Body: { year, planType?, entries: [{ metric, month, value }] }
========================= */
export async function PUT(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { year, entries, planType: rawPlanType } = body as {
    year: number;
    entries: { metric: string; month: number; value: number | null }[];
    planType?: string;
  };

  if (!year || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const planType = parsePlanType(rawPlanType ?? null);
  const validMetrics = getValidMetrics(planType);

  const validEntries = entries.filter(
    (e) =>
      validMetrics.has(e.metric) &&
      e.month >= 1 &&
      e.month <= 12 &&
      (e.value === null || (typeof e.value === "number" && isFinite(e.value)))
  );

  await prisma.$transaction(
    validEntries.map((e) =>
      e.value === null
        ? prisma.planningEntry.deleteMany({
            where: {
              tenantId: session.tenantId,
              year,
              month: e.month,
              metric: e.metric,
              planType,
            },
          })
        : prisma.planningEntry.upsert({
            where: {
              tenantId_year_month_metric_planType: {
                tenantId: session.tenantId,
                year,
                month: e.month,
                metric: e.metric,
                planType,
              },
            },
            update: { value: e.value, source: "manual" },
            create: {
              tenantId: session.tenantId,
              year,
              month: e.month,
              metric: e.metric,
              value: e.value,
              source: "manual",
              planType,
            },
          })
    )
  );

  const rows = await prisma.planningEntry.findMany({
    where: { tenantId: session.tenantId, year, planType },
  });

  const { entries: result, sources } = buildResponse(rows);

  return NextResponse.json({ year, planType, entries: result, sources });
}
