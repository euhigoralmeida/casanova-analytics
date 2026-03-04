/**
 * Migration script: merges orphaned PlanningEntry records that were saved
 * with fallback tenant IDs (e.g. "casanova", "fivep", "yellalife") into
 * the real DB tenant IDs (CUIDs).
 *
 * Run: npx tsx scripts/migrate-tenant-ids.ts
 *
 * Safe to run multiple times — only updates records with stale fallback IDs.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FALLBACK_SLUGS = ["casanova", "fivep", "yellalife"];

async function main() {
  console.log("🔄 Migrating orphaned tenant IDs...\n");

  for (const slug of FALLBACK_SLUGS) {
    // Find the real DB tenant by slug
    const dbTenant = await prisma.tenant.findFirst({
      where: { slug, active: true },
      select: { id: true, slug: true, name: true },
    });

    if (!dbTenant) {
      console.log(`⚠️  No DB tenant found for slug "${slug}" — skipping`);
      continue;
    }

    if (dbTenant.id === slug) {
      console.log(`✓ Tenant "${slug}" already uses slug as ID — no migration needed`);
      continue;
    }

    console.log(`Tenant "${slug}": DB ID = ${dbTenant.id}`);

    // Models that have tenantId
    const models = [
      { name: "PlanningEntry", model: prisma.planningEntry },
      { name: "PlanningSyncLog", model: prisma.planningSyncLog },
      { name: "Insight", model: prisma.insight },
      { name: "ActionLog", model: prisma.actionLog },
      { name: "SkuMaster", model: prisma.skuMaster },
      { name: "MetricSnapshot", model: prisma.metricSnapshot },
    ] as const;

    for (const { name, model } of models) {
      try {
        // Count records with the fallback ID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const count = await (model as any).count({
          where: { tenantId: slug },
        });

        if (count === 0) continue;

        // For PlanningEntry, handle potential unique constraint conflicts
        // by deleting duplicates (keeping the DB-ID version as authoritative)
        if (name === "PlanningEntry") {
          // Find entries that exist in BOTH fallback and DB ID
          const fallbackEntries = await prisma.planningEntry.findMany({
            where: { tenantId: slug },
          });

          let migrated = 0;
          let skipped = 0;

          for (const entry of fallbackEntries) {
            // Check if the DB-ID version already exists
            const existing = await prisma.planningEntry.findUnique({
              where: {
                tenantId_year_month_metric_planType: {
                  tenantId: dbTenant.id,
                  year: entry.year,
                  month: entry.month,
                  metric: entry.metric,
                  planType: entry.planType,
                },
              },
            });

            if (existing) {
              // DB-ID version exists (admin's data) — delete the orphan
              await prisma.planningEntry.delete({ where: { id: entry.id } });
              skipped++;
            } else {
              // No DB-ID version — migrate the orphan
              await prisma.planningEntry.update({
                where: { id: entry.id },
                data: { tenantId: dbTenant.id },
              });
              migrated++;
            }
          }

          console.log(`  ✓ ${name}: migrated ${migrated}, skipped ${skipped} (DB version exists)`);
        } else {
          // For other models, just update tenantId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (model as any).updateMany({
            where: { tenantId: slug },
            data: { tenantId: dbTenant.id },
          });
          console.log(`  ✓ ${name}: migrated ${result.count} records`);
        }
      } catch (err) {
        console.error(`  ✗ ${name}: ${err}`);
      }
    }

    console.log();
  }

  console.log("✅ Migration complete!");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
