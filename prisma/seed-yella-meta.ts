/**
 * Seed script: inserts Meta Ads credentials for Yella Life tenant.
 *
 * Run: npx tsx prisma/seed-yella-meta.ts
 *
 * Requires CREDENTIALS_ENCRYPTION_KEY and DATABASE_URL in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptCredentials } from "../lib/secrets";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔐 Inserting Meta Ads credentials for Yella Life...\n");

  // 1. Find the yellalife tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: "yellalife" } });
  if (!tenant) {
    throw new Error('Tenant "yellalife" not found. Run seed-tenant.ts first.');
  }
  console.log(`  ✓ Found tenant: ${tenant.name} (${tenant.id})`);

  // 2. Encrypt credentials
  const credentials = encryptCredentials({
    access_token:
      "EAAM5hDZC5GTwBQxPGxHfZC8ehcLnNkjDGpIx48wEpwLCvT71inHZCVTgH8UIIGkbR2wqYylOVSZAxPpuMBp4UkRnh3ZBPSvzgT0Lsxj7TniZCcxbmhhmmkYR5enUimN4qG2NC6UD4ZA1WCfoXZCidZAVvjwNZAL74obGGp8qdN6eTcFbIeieRxfn1KdfYXfzuK4VTFG509IbP2isU7aUg4XepKsBWnr7pHs8Jhxir1W",
    account_id: "1038484621810091,754206617671334",
  });
  console.log("  ✓ Credentials encrypted");

  // 3. Upsert integration
  const integration = await prisma.integration.upsert({
    where: { tenantId_platform: { tenantId: tenant.id, platform: "meta_ads" } },
    update: { credentials, active: true },
    create: {
      tenantId: tenant.id,
      platform: "meta_ads",
      label: "Meta Ads",
      credentials,
      active: true,
    },
  });
  console.log(`  ✓ Integration upserted: ${integration.id} (platform: meta_ads)`);

  console.log("\n✅ Yella Life Meta Ads credentials configured!");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
