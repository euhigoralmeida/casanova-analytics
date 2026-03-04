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

// Multi-tenant: Map de clients por tenantId (with TTL)
const CLIENT_TTL = 5 * 60 * 1000; // 5 minutes
const _clients = new Map<string, { client: BetaAnalyticsDataClient; ts: number }>();
const _propertyIds = new Map<string, { id: string; ts: number }>();

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
  const entry = _clients.get(key);
  if (entry && Date.now() - entry.ts < CLIENT_TTL) return entry.client;

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL!,
      private_key: getPrivateKey(),
    },
  });
  _clients.set(key, { client, ts: Date.now() });
  return client;
}

/**
 * Async version — checks DB credentials first.
 * Returns null if the tenant has no GA4 credentials configured.
 */
export async function getGA4ClientAsync(tenantId?: string): Promise<BetaAnalyticsDataClient | null> {
  const key = tenantId ?? "default";
  const existing = _clients.get(key);
  if (existing && Date.now() - existing.ts < CLIENT_TTL) return existing.client;

  // TTL expired or not cached
  _clients.delete(key);
  _propertyIds.delete(key);

  const creds = await getTenantCredentials(tenantId, "ga4");
  if (!creds) return null;

  const now = Date.now();
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
  });
  _propertyIds.set(key, { id: creds.property_id, ts: now });
  _clients.set(key, { client, ts: now });
  return client;
}

/**
 * Returns the GA4 property ID for a tenant.
 * Returns null if no property ID is available (tenant not configured).
 */
export function getPropertyId(tenantId?: string): string | null {
  const key = tenantId ?? "default";
  const cached = _propertyIds.get(key);
  if (cached && Date.now() - cached.ts < CLIENT_TTL) return `properties/${cached.id}`;
  return null;
}
