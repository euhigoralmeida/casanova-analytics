import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getTenantCredentials } from "@/lib/tenant-credentials";

/* =========================
   Configuração GA4
========================= */

export function isGA4Configured(): boolean {
  return !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_CLIENT_EMAIL &&
    (process.env.GA4_PRIVATE_KEY || process.env.GA4_PRIVATE_KEY_BASE64)
  );
}

// Multi-tenant: Map de clients por tenantId
const _clients = new Map<string, BetaAnalyticsDataClient>();
const _propertyIds = new Map<string, string>();

function getPrivateKey(): string {
  if (process.env.GA4_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  const raw = process.env.GA4_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n").trim();
}

/** Sync version (env vars only) — backward compatible. */
export function getGA4Client(tenantId?: string): BetaAnalyticsDataClient {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (!client) {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL!,
        private_key: getPrivateKey(),
      },
    });
    _clients.set(key, client);
  }
  return client;
}

/** Async version — checks DB credentials first, falls back to env vars. */
export async function getGA4ClientAsync(tenantId?: string): Promise<BetaAnalyticsDataClient> {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (client) return client;

  const creds = await getTenantCredentials(tenantId, "ga4");
  if (creds) {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
    });
    _propertyIds.set(key, creds.property_id);
  } else {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL!,
        private_key: getPrivateKey(),
      },
    });
  }
  _clients.set(key, client);
  return client;
}

export function getPropertyId(tenantId?: string): string {
  const key = tenantId ?? "default";
  const cached = _propertyIds.get(key);
  if (cached) return `properties/${cached}`;
  return `properties/${process.env.GA4_PROPERTY_ID}`;
}
