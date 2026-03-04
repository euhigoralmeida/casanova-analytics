import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantCredentials } from "../lib/tenant-credentials";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "yellalife" } });
  if (!tenant) { console.log("Tenant not found"); return; }
  console.log("Tenant ID:", tenant.id);

  const gads = await getTenantCredentials(tenant.id, "google_ads");
  console.log("Google Ads:", gads
    ? { customer_id: gads.customer_id, has_refresh: Boolean(gads.refresh_token), has_dev_token: Boolean(gads.developer_token) }
    : null);

  const meta = await getTenantCredentials(tenant.id, "meta_ads");
  console.log("Meta Ads:", meta
    ? { has_token: Boolean(meta.access_token), account_id: meta.account_id }
    : null);

  const ga4 = await getTenantCredentials(tenant.id, "ga4");
  console.log("GA4:", ga4
    ? { property_id: ga4.property_id, has_key: Boolean(ga4.private_key || ga4.private_key_base64) }
    : null);

  // Quick test: Google Ads API call
  if (gads) {
    try {
      const { getCustomerAsync } = await import("../lib/google-ads");
      const customer = await getCustomerAsync(tenant.id);
      if (customer) {
        const rows = await customer.query(`
          SELECT metrics.cost_micros, metrics.conversions, metrics.conversions_value
          FROM campaign
          WHERE segments.date BETWEEN '2026-01-01' AND '2026-01-31'
            AND campaign.status != 'REMOVED'
          LIMIT 1
        `);
        console.log("Google Ads API OK - rows:", rows.length);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("Google Ads API ERROR:", msg.slice(0, 300));
    }
  }

  // Quick test: Meta Ads
  if (meta) {
    try {
      const { fetchMetaAccountTotals } = await import("../lib/meta-ads");
      const totals = await fetchMetaAccountTotals("2026-01-01", "2026-01-31", tenant.id);
      console.log("Meta Ads API OK - spend:", totals.spend);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("Meta Ads API ERROR:", msg.slice(0, 300));
    }
  }
}

main()
  .catch((e) => console.error("FATAL:", e.message))
  .finally(() => prisma.$disconnect());
