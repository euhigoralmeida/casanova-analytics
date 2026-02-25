import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";

/**
 * Returns the connection status of each integration platform.
 * Checks env vars to determine if each platform is configured.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const integrations = [
    {
      platform: "google_ads",
      connected: !!(
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        process.env.GOOGLE_ADS_CLIENT_ID &&
        process.env.GOOGLE_ADS_CUSTOMER_ID
      ),
    },
    {
      platform: "ga4",
      connected: !!(
        process.env.GA4_PROPERTY_ID &&
        process.env.GA4_CLIENT_EMAIL &&
        (process.env.GA4_PRIVATE_KEY || process.env.GA4_PRIVATE_KEY_BASE64)
      ),
    },
    {
      platform: "meta_ads",
      connected: !!(
        process.env.META_ADS_ACCESS_TOKEN &&
        process.env.META_ADS_ACCOUNT_ID
      ),
    },
    {
      platform: "google_search_console",
      connected: !!(
        process.env.GSC_SITE_URL &&
        (process.env.GSC_CLIENT_EMAIL || process.env.GA4_CLIENT_EMAIL)
      ),
    },
    {
      platform: "clarity",
      connected: !!(
        process.env.CLARITY_PROJECT_ID &&
        process.env.CLARITY_API_TOKEN
      ),
    },
    {
      platform: "instagram",
      connected: !!(process.env.META_ADS_ACCESS_TOKEN),
    },
  ];

  return NextResponse.json({ integrations });
}
