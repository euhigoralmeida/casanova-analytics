/**
 * Seed script: creates/updates tenants and users in the database.
 *
 * Run: npx tsx prisma/seed-tenant.ts
 *
 * Safe to run multiple times — uses upsert to avoid duplicates.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding tenant: casanova...");

  // Upsert tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "casanova" },
    update: { name: "Casanova Metais" },
    create: {
      name: "Casanova Metais",
      slug: "casanova",
      plan: "pro",
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // Upsert admin user (same password hash from hardcoded config)
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@casanova.com" } },
    update: { name: "Admin Casanova", role: "admin" },
    create: {
      email: "admin@casanova.com",
      name: "Admin Casanova",
      role: "admin",
      // Hash for "casanova2024"
      passwordHash: "$2b$10$KmWh4VEMh1vOMCuXbe2KRe/lUansSYhDyKX7H5h/ZcEuDyKnfwWe2",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ User: ${user.email} (${user.role})`);

  // Migrate existing PlanningEntry/Insight/etc. to use the new tenant ID
  // (only if they still use the "default" tenantId)
  const models = [
    { name: "PlanningEntry", model: prisma.planningEntry },
    { name: "PlanningSyncLog", model: prisma.planningSyncLog },
    { name: "Insight", model: prisma.insight },
    { name: "ActionLog", model: prisma.actionLog },
    { name: "SkuMaster", model: prisma.skuMaster },
    { name: "MetricSnapshot", model: prisma.metricSnapshot },
  ] as const;

  for (const { name, model } of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (model as any).updateMany({
      where: { tenantId: "default" },
      data: { tenantId: tenant.id },
    });
    if (result.count > 0) {
      console.log(`  ✓ Migrated ${result.count} ${name} records from "default" to "${tenant.id}"`);
    }
  }

  // ─── Fivep (platform admin) ───
  console.log("\n🌱 Seeding tenant: fivep...");

  const fivepTenant = await prisma.tenant.upsert({
    where: { slug: "fivep" },
    update: { name: "Fivep" },
    create: {
      name: "Fivep",
      slug: "fivep",
      plan: "enterprise",
    },
  });
  console.log(`  ✓ Tenant: ${fivepTenant.name} (${fivepTenant.id})`);

  const fivepUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: fivepTenant.id, email: "contato@fivep.com.br" } },
    update: { name: "Higo Almeida", role: "admin", globalRole: "platform_admin" },
    create: {
      email: "contato@fivep.com.br",
      name: "Higo Almeida",
      role: "admin",
      globalRole: "platform_admin",
      passwordHash: "$2b$10$BP4iT6uj62HBkZ5COZ7IeuTVTsShRHW2T4ofZzIqv8GKy1lF1AEQG",
      tenantId: fivepTenant.id,
    },
  });
  console.log(`  ✓ User: ${fivepUser.email} (${fivepUser.role}, globalRole: platform_admin)`);

  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
