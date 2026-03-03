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

/** Clear cached clients for a tenant (call when credentials are rotated). */
export function clearGA4Clients(tenantId: string): void {
  _clients.delete(tenantId);
  _propertyIds.delete(tenantId);
}

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

/**
 * Async version — checks DB credentials first.
 * Returns null if the tenant has no GA4 credentials configured.
 */
export async function getGA4ClientAsync(tenantId?: string): Promise<BetaAnalyticsDataClient | null> {
  const key = tenantId ?? "default";
  const existing = _clients.get(key);
  if (existing) return existing;

  const creds = await getTenantCredentials(tenantId, "ga4");
  if (!creds) return null;

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
  });
  _propertyIds.set(key, creds.property_id);
  _clients.set(key, client);
  return client;
}

/**
 * Returns the GA4 property ID for a tenant.
 * Returns null if no property ID is available (tenant not configured).
 */
export function getPropertyId(tenantId?: string): string | null {
  const key = tenantId ?? "default";
  const cached = _propertyIds.get(key);
  if (cached) return `properties/${cached}`;
  return null;
}
