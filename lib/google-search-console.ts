import { google, searchconsole_v1 } from "googleapis";
import { getTenantCredentials } from "@/lib/tenant-credentials";

/* =========================
   Configuracao GSC
========================= */

export function isGSCConfigured(): boolean {
  const hasGSCCreds = !!(
    process.env.GSC_CLIENT_EMAIL &&
    (process.env.GSC_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY_BASE64)
  );
  const hasGA4Creds = !!(
    process.env.GA4_CLIENT_EMAIL &&
    (process.env.GA4_PRIVATE_KEY || process.env.GA4_PRIVATE_KEY_BASE64)
  );
  return !!(process.env.GSC_SITE_URL && (hasGSCCreds || hasGA4Creds));
}

// Multi-tenant: Map de clients por tenantId
const _clients = new Map<string, searchconsole_v1.Searchconsole>();

/** Clear cached clients for a tenant (call when credentials are rotated). */
export function clearGSCClients(tenantId: string): void {
  _clients.delete(tenantId);
}

function getPrivateKey(): string {
  if (process.env.GSC_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GSC_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  if (process.env.GSC_PRIVATE_KEY) {
    return process.env.GSC_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
  }
  if (process.env.GA4_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  if (process.env.GA4_PRIVATE_KEY) {
    return process.env.GA4_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
  }
  return "";
}

function getClientEmail(): string {
  return process.env.GSC_CLIENT_EMAIL ?? process.env.GA4_CLIENT_EMAIL ?? "";
}

/** Sync version (env vars only). */
export function getGSCClient(tenantId?: string): searchconsole_v1.Searchconsole {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (!client) {
    const auth = new google.auth.JWT({
      email: getClientEmail(),
      key: getPrivateKey(),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    client = google.searchconsole({ version: "v1", auth });
    _clients.set(key, client);
  }
  return client;
}

/**
 * Async version — checks DB credentials first.
 * Returns null if the tenant has no GSC credentials configured.
 */
export async function getGSCClientAsync(tenantId?: string): Promise<searchconsole_v1.Searchconsole | null> {
  const key = tenantId ?? "default";
  const existing = _clients.get(key);
  if (existing) return existing;

  const creds = await getTenantCredentials(tenantId, "google_search_console");
  if (!creds) return null;

  // Store site URL from DB credentials if available
  if (creds.site_url) {
    _siteUrls.set(key, creds.site_url);
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const client = google.searchconsole({ version: "v1", auth });
  _clients.set(key, client);
  return client;
}

/**
 * Returns the site URL for a tenant.
 * Returns null if no site URL is available (tenant not configured).
 */
export function getSiteUrl(tenantId?: string): string | null {
  const key = tenantId ?? "default";
  const cached = _siteUrls.get(key);
  if (cached) return cached;
  return null;
}

const _siteUrls = new Map<string, string>();

/** Store site URL from DB credentials when using async client. */
export function setSiteUrl(tenantId: string, siteUrl: string): void {
  _siteUrls.set(tenantId, siteUrl);
}
