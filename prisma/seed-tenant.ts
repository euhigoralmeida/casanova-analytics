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
    update: { name: "Casanova", logo: "/logo-casanova.png", onboardingStatus: "complete" },
    create: {
      name: "Casanova",
      slug: "casanova",
      logo: "/logo-casanova.png",
      plan: "pro",
      onboardingStatus: "complete",
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // Delete old user (email changed from admin@casanova.com → casanova@fivep.com.br)
  await prisma.user.deleteMany({
    where: { tenantId: tenant.id, email: { not: "casanova@fivep.com.br" } },
  });

  // Upsert admin user
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "casanova@fivep.com.br" } },
    update: { name: "Admin Casanova", role: "admin", passwordHash: "$2b$12$T2f9oRaehlbIR0/hnVJ12eoPdDiUJBfU8jV7VV1RiyO1pPUqmzRgu" },
    create: {
      email: "casanova@fivep.com.br",
      name: "Admin Casanova",
      role: "admin",
      // Hash for "casanova2026$"
      passwordHash: "$2b$12$T2f9oRaehlbIR0/hnVJ12eoPdDiUJBfU8jV7VV1RiyO1pPUqmzRgu",
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
    update: { name: "Fivep", logo: "/logo-fivep.png", onboardingStatus: "complete" },
    create: {
      name: "Fivep",
      slug: "fivep",
      logo: "/logo-fivep.png",
      plan: "enterprise",
      onboardingStatus: "complete",
    },
  });
  console.log(`  ✓ Tenant: ${fivepTenant.name} (${fivepTenant.id})`);

  // Delete old user (email changed from contato@fivep.com.br → adm@fivep.com.br)
  await prisma.user.deleteMany({
    where: { tenantId: fivepTenant.id, email: { not: "adm@fivep.com.br" } },
  });

  const fivepUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: fivepTenant.id, email: "adm@fivep.com.br" } },
    update: { name: "Higo Almeida", role: "admin", globalRole: "platform_admin", passwordHash: "$2b$12$xTXW7iLmNQR6/HjF24oYvOI7g1/yI8fzBSL.VD9WWZB9rSZvbY7vy" },
    create: {
      email: "adm@fivep.com.br",
      name: "Higo Almeida",
      role: "admin",
      globalRole: "platform_admin",
      // Hash for "fivep2026$"
      passwordHash: "$2b$12$xTXW7iLmNQR6/HjF24oYvOI7g1/yI8fzBSL.VD9WWZB9rSZvbY7vy",
      tenantId: fivepTenant.id,
    },
  });
  console.log(`  ✓ User: ${fivepUser.email} (${fivepUser.role}, globalRole: platform_admin)`);

  // ─── Yella Life ───
  console.log("\n🌱 Seeding tenant: yellalife...");

  const yellaTenant = await prisma.tenant.upsert({
    where: { slug: "yellalife" },
    update: { name: "Yella Life", logo: "/logo-yellalife.png", onboardingStatus: "complete" },
    create: {
      name: "Yella Life",
      slug: "yellalife",
      logo: "/logo-yellalife.png",
      plan: "pro",
      onboardingStatus: "complete",
    },
  });
  console.log(`  ✓ Tenant: ${yellaTenant.name} (${yellaTenant.id})`);

  // Delete old user (email changed from admin@yellalife.com → yella@fivep.com.br)
  await prisma.user.deleteMany({
    where: { tenantId: yellaTenant.id, email: { not: "yella@fivep.com.br" } },
  });

  const yellaUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: yellaTenant.id, email: "yella@fivep.com.br" } },
    update: { name: "Admin Yella Life", role: "admin", passwordHash: "$2b$12$WyHPLeDXsTxTI87w7Ic.JOByfM7POqDVngoU/c4di4dC3nDsfpXEW" },
    create: {
      email: "yella@fivep.com.br",
      name: "Admin Yella Life",
      role: "admin",
      // Hash for "yella2026$"
      passwordHash: "$2b$12$WyHPLeDXsTxTI87w7Ic.JOByfM7POqDVngoU/c4di4dC3nDsfpXEW",
      tenantId: yellaTenant.id,
    },
  });
  console.log(`  ✓ User: ${yellaUser.email} (${yellaUser.role})`);

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
