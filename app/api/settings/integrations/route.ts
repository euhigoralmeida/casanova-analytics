import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import { getTenantCredentials, type Platform } from "@/lib/tenant-credentials";

const PLATFORMS: Platform[] = [
  "google_ads",
  "ga4",
  "meta_ads",
  "google_search_console",
  "clarity",
  "instagram",
];

/**
 * Returns the connection status of each integration platform.
 * Checks DB credentials first (per tenant), then falls back to env vars.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const tenantId = getEffectiveTenantId(auth.session);

  const integrations = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const creds = await getTenantCredentials(tenantId, platform);
      return {
        platform,
        connected: !!creds,
      };
    }),
  );

  return NextResponse.json({ integrations });
}
