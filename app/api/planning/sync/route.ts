export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireTenantContext } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { getCustomerAsync, clearGoogleAdsClients } from "@/lib/google-ads";
import { getGA4ClientAsync, clearGA4Clients } from "@/lib/google-analytics";
import { fetchAccountTotals } from "@/lib/queries";
import { fetchGA4Summary, fetchChannelAcquisition } from "@/lib/ga4-queries";
import { fetchMetaAccountTotals } from "@/lib/meta-ads";
import { logger } from "@/lib/logger";

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type SyncEntry = { metric: string; month: number; value: number };
type SourceStatus = { source: string; status: "ok" | "not_configured" | "error"; detail?: string };

async function fetchMonthData(
  year: number,
  month: number,
  tenantId?: string,
  sourceStatuses?: Map<string, SourceStatus>,
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
    return fetchMonthDataRange(month, startDate, adjustedEnd, tenantId, sourceStatuses);
  }

  return fetchMonthDataRange(month, startDate, endDate, tenantId, sourceStatuses);
}

async function fetchMonthDataRange(
  month: number,
  startDate: string,
  endDate: string,
  tenantId?: string,
  sourceStatuses?: Map<string, SourceStatus>,
): Promise<SyncEntry[]> {
  const entries: SyncEntry[] = [];

  const PAID_CHANNELS = ["Cross-network", "Paid Search", "Paid Social", "Paid Shopping", "Paid Other", "Display"];
  const ORGANIC_CHANNELS = ["Organic Search", "Organic Social", "Organic Shopping"];

  // Google Ads data
  try {
    const customer = await getCustomerAsync(tenantId);
    if (customer) {
      const totals = await fetchAccountTotals(customer, "custom", startDate, endDate, tenantId);
      if (totals) {
        entries.push({ metric: "google_ads", month, value: Math.round(totals.costBRL * 100) / 100 });
        if (totals.revenue > 0) {
          entries.push({ metric: "google_ads_faturamento", month, value: Math.round(totals.revenue * 100) / 100 });
        }
        entries.push({ metric: "google_ads_vendas", month, value: Math.round(totals.conversions * 100) / 100 });
        if (sourceStatuses && !sourceStatuses.has("google_ads")) {
          sourceStatuses.set("google_ads", { source: "Google Ads", status: "ok" });
        }
      }
    } else if (sourceStatuses && !sourceStatuses.has("google_ads")) {
      sourceStatuses.set("google_ads", { source: "Google Ads", status: "not_configured", detail: "Credenciais não configuradas" });
    }
  } catch (err) {
    logger.error("Sync: Google Ads error", { route: "/api/planning/sync", tenantId, month }, err);
    if (sourceStatuses && !sourceStatuses.has("google_ads")) {
      const msg = err instanceof Error ? err.message : String(err);
      sourceStatuses.set("google_ads", { source: "Google Ads", status: "error", detail: msg.slice(0, 200) });
    }
  }

  // Meta Ads data
  try {
    const metaTotals = await fetchMetaAccountTotals(startDate, endDate, tenantId);
    if (metaTotals && metaTotals.spend > 0) {
      entries.push({ metric: "meta_ads", month, value: Math.round(metaTotals.spend * 100) / 100 });
      if (metaTotals.revenue > 0) {
        entries.push({ metric: "meta_ads_faturamento", month, value: Math.round(metaTotals.revenue * 100) / 100 });
      }
      entries.push({ metric: "meta_ads_vendas", month, value: Math.round(metaTotals.conversions * 100) / 100 });
    }
    if (sourceStatuses && !sourceStatuses.has("meta_ads")) {
      sourceStatuses.set("meta_ads", { source: "Meta Ads", status: "ok" });
    }
  } catch (err) {
    logger.error("Sync: Meta Ads error", { route: "/api/planning/sync", tenantId, month }, err);
    if (sourceStatuses && !sourceStatuses.has("meta_ads")) {
      const msg = err instanceof Error ? err.message : String(err);
      const notConfigured = msg.includes("NOT_CONFIGURED");
      sourceStatuses.set("meta_ads", {
        source: "Meta Ads",
        status: notConfigured ? "not_configured" : "error",
        detail: notConfigured ? "Credenciais não configuradas" : msg.slice(0, 200),
      });
    }
  }

  // GA4 data
  try {
    const ga4Client = await getGA4ClientAsync(tenantId);
    if (!ga4Client) {
      if (sourceStatuses && !sourceStatuses.has("ga4")) {
        sourceStatuses.set("ga4", { source: "GA4", status: "not_configured", detail: "Credenciais não configuradas" });
      }
      return entries;
    }
    const [summary, channels] = await Promise.all([
      fetchGA4Summary(ga4Client, startDate, endDate, tenantId),
      fetchChannelAcquisition(ga4Client, startDate, endDate, tenantId),
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
      if (sourceStatuses && !sourceStatuses.has("ga4")) {
        sourceStatuses.set("ga4", { source: "GA4", status: "ok" });
      }
  } catch (err) {
    logger.error("Sync: GA4 error", { route: "/api/planning/sync", tenantId, month }, err);
    if (sourceStatuses && !sourceStatuses.has("ga4")) {
      const msg = err instanceof Error ? err.message : String(err);
      sourceStatuses.set("ga4", { source: "GA4", status: "error", detail: msg.slice(0, 200) });
    }
  }

  return entries;
}

/* =========================
   POST /api/planning/sync
   Body: { year }
========================= */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  if (session.role !== "admin" && session.globalRole !== "platform_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }
  const tenantId = requireTenantContext(session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
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

  try {
    // Clear cached API clients to pick up rotated credentials
    clearGoogleAdsClients(tenantId);
    clearGA4Clients(tenantId);

    // Fetch data for each month (sequentially to avoid rate limits)
    const allEntries: SyncEntry[] = [];
    const sourceStatuses = new Map<string, SourceStatus>();
    for (let m = 1; m <= maxMonth; m++) {
      const monthEntries = await fetchMonthData(year, m, tenantId, sourceStatuses);
      allEntries.push(...monthEntries);
    }

    // Build warnings from source statuses
    const warnings: string[] = [];
    for (const [, s] of sourceStatuses) {
      if (s.status === "not_configured") {
        warnings.push(`${s.source}: ${s.detail}`);
      } else if (s.status === "error") {
        warnings.push(`${s.source}: Erro — ${s.detail}`);
      }
    }

    if (allEntries.length === 0) {
      return NextResponse.json({
        error: "Nenhum dado disponível nas plataformas",
        warnings,
      }, { status: 404 });
    }

    // Upsert all sync entries — always overwrites since these are platform-owned metrics
    for (const e of allEntries) {
      await prisma.planningEntry.upsert({
        where: {
          tenantId_year_month_metric_planType: {
            tenantId: tenantId,
            year,
            month: e.month,
            metric: e.metric,
            planType: "actual",
          },
        },
        update: { value: e.value, source: "sync" },
        create: {
          tenantId: tenantId,
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
        tenantId: tenantId,
        year,
        metrics: allEntries.length,
      },
    });

    // Return updated data
    const rows = await prisma.planningEntry.findMany({
      where: { tenantId: tenantId, year, planType: "actual" },
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
      warnings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Sync: unhandled error", { route: "/api/planning/sync", tenantId, year }, err);
    return NextResponse.json({ error: `Erro interno: ${msg.slice(0, 300)}` }, { status: 500 });
  }
}
