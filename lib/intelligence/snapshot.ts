/* =========================
   MetricSnapshot — Persistência e consulta de snapshots diários
   Usado pelo trend analyzer para calcular tendências históricas.
========================= */

import { prisma } from "@/lib/db";

export type SnapshotMetrics = {
  revenue?: number;
  ads?: number;
  roas?: number;
  cpa?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
};

/**
 * Persiste snapshot do dia atual. Upsert para idempotência.
 * Chamado async (fire-and-forget) após intelligence API.
 */
export async function persistDailySnapshot(
  tenantId: string,
  date: string,
  accountMetrics?: SnapshotMetrics,
  skuMetrics?: Array<{ sku: string; metrics: SnapshotMetrics }>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: Promise<any>[] = [];

  if (accountMetrics) {
    ops.push(
      prisma.metricSnapshot.upsert({
        where: { tenantId_date_scope: { tenantId, date, scope: "account" } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: { metrics: accountMetrics as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: { tenantId, date, scope: "account", metrics: accountMetrics as any },
      })
    );
  }

  if (skuMetrics) {
    for (const s of skuMetrics.slice(0, 50)) {
      const scope = `sku:${s.sku}`;
      ops.push(
        prisma.metricSnapshot.upsert({
          where: { tenantId_date_scope: { tenantId, date, scope } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: { metrics: s.metrics as any },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: { tenantId, date, scope, metrics: s.metrics as any },
        })
      );
    }
  }

  // Batch em chunks de 10
  for (let i = 0; i < ops.length; i += 10) {
    await Promise.all(ops.slice(i, i + 10));
  }
}

/**
 * Recupera snapshots históricos para um scope.
 * Retorna ordenado por data ascendente.
 */
export async function fetchHistoricalSnapshots(
  tenantId: string,
  scope: string,
  days: number = 30,
): Promise<Array<{ date: string; metrics: SnapshotMetrics }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await prisma.metricSnapshot.findMany({
    where: { tenantId, scope, date: { gte: cutoffStr } },
    orderBy: { date: "asc" },
    select: { date: true, metrics: true },
  });

  return rows.map((r) => ({
    date: r.date,
    metrics: r.metrics as SnapshotMetrics,
  }));
}
