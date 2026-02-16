import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConfigured, getCustomer } from "@/lib/google-ads";
import { isGA4Configured, getGA4Client } from "@/lib/google-analytics";
import { fetchAccountTotals } from "@/lib/queries";
import { fetchGA4Summary, fetchChannelAcquisition } from "@/lib/ga4-queries";

function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Metrics we auto-sync from platforms (gray rows) */
const SYNC_METRICS = [
  "google_ads",
  "usuarios_visitantes",
  "sessoes_totais",
  "sessoes_midia",
  "sessoes_organicas",
  "sessoes_engajadas",
  "taxa_rejeicao",
] as const;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type SyncEntry = { metric: string; month: number; value: number };

async function fetchMonthData(
  year: number,
  month: number,
): Promise<SyncEntry[]> {
  const startDate = formatDate(year, month, 1);
  const lastDay = daysInMonth(year, month);
  const endDate = formatDate(year, month, lastDay);

  // Don't fetch future months
  const now = new Date();
  const monthEnd = new Date(year, month - 1, lastDay);
  if (monthEnd > now) {
    // Partial month: use today as end date if month has started
    const monthStart = new Date(year, month - 1, 1);
    if (monthStart > now) return []; // Fully future month
    // Use yesterday or today
    const today = new Date();
    const endDay = today.getDate();
    const adjustedEnd = formatDate(year, month, endDay);
    return fetchMonthDataRange(month, startDate, adjustedEnd);
  }

  return fetchMonthDataRange(month, startDate, endDate);
}

async function fetchMonthDataRange(
  month: number,
  startDate: string,
  endDate: string,
): Promise<SyncEntry[]> {
  const entries: SyncEntry[] = [];

  const PAID_CHANNELS = ["Cross-network", "Paid Search", "Paid Social", "Paid Shopping", "Paid Other", "Display"];
  const ORGANIC_CHANNELS = ["Organic Search", "Organic Social", "Organic Shopping"];

  // Google Ads data
  if (isConfigured()) {
    try {
      const customer = getCustomer();
      const totals = await fetchAccountTotals(customer, "custom", startDate, endDate);
      if (totals) {
        entries.push({ metric: "google_ads", month, value: Math.round(totals.costBRL * 100) / 100 });
      }
    } catch (err) {
      console.error(`Sync: Google Ads error for month ${month}:`, err);
    }
  }

  // GA4 data
  if (isGA4Configured()) {
    try {
      const ga4Client = getGA4Client();
      const [summary, channels] = await Promise.all([
        fetchGA4Summary(ga4Client, startDate, endDate),
        fetchChannelAcquisition(ga4Client, startDate, endDate),
      ]);

      const sessoesMidia = channels
        .filter((c) => PAID_CHANNELS.includes(c.channel))
        .reduce((sum, c) => sum + c.sessions, 0);

      const sessoesOrganicas = channels
        .filter((c) => ORGANIC_CHANNELS.includes(c.channel))
        .reduce((sum, c) => sum + c.sessions, 0);

      entries.push(
        { metric: "usuarios_visitantes", month, value: summary.users },
        { metric: "sessoes_totais", month, value: summary.sessions },
        { metric: "sessoes_midia", month, value: sessoesMidia },
        { metric: "sessoes_organicas", month, value: sessoesOrganicas },
        { metric: "sessoes_engajadas", month, value: summary.engagedSessions },
        { metric: "taxa_rejeicao", month, value: Math.round(summary.bounceRate * 10000) / 10000 },
      );
    } catch (err) {
      console.error(`Sync: GA4 error for month ${month}:`, err);
    }
  }

  return entries;
}

/* =========================
   POST /api/planning/sync
   Body: { year }
========================= */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const year = body.year as number;

  if (!year || year < 2020 || year > 2040) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }

  // Determine which months to sync (only past + current)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxMonth = year < currentYear ? 12 : year === currentYear ? currentMonth : 0;

  if (maxMonth === 0) {
    return NextResponse.json({ error: "Ano futuro, sem dados para sincronizar" }, { status: 400 });
  }

  // Fetch data for each month (sequentially to avoid rate limits)
  const allEntries: SyncEntry[] = [];
  for (let m = 1; m <= maxMonth; m++) {
    const monthEntries = await fetchMonthData(year, m);
    allEntries.push(...monthEntries);
  }

  if (allEntries.length === 0) {
    return NextResponse.json({ error: "Nenhum dado disponível nas plataformas" }, { status: 404 });
  }

  // Upsert all sync entries — always overwrites since these are platform-owned metrics
  for (const e of allEntries) {
    await prisma.planningEntry.upsert({
      where: {
        tenantId_year_month_metric_planType: {
          tenantId: session.tenantId,
          year,
          month: e.month,
          metric: e.metric,
          planType: "actual",
        },
      },
      update: { value: e.value, source: "sync" },
      create: {
        tenantId: session.tenantId,
        year,
        month: e.month,
        metric: e.metric,
        value: e.value,
        source: "sync",
        planType: "actual",
      },
    });
  }

  // Log the sync
  await prisma.planningSyncLog.create({
    data: {
      tenantId: session.tenantId,
      year,
      metrics: allEntries.length,
    },
  });

  // Return updated data
  const rows = await prisma.planningEntry.findMany({
    where: { tenantId: session.tenantId, year, planType: "actual" },
  });

  const entries: Record<number, Record<string, number>> = {};
  const sources: Record<number, Record<string, string>> = {};
  for (const row of rows) {
    if (!entries[row.month]) entries[row.month] = {};
    entries[row.month][row.metric] = row.value;
    if (!sources[row.month]) sources[row.month] = {};
    sources[row.month][row.metric] = row.source;
  }

  return NextResponse.json({
    year,
    entries,
    sources,
    syncedAt: new Date().toISOString(),
    syncedMetrics: allEntries.length,
  });
}
