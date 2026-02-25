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

/** Async version — checks DB credentials first. */
export async function getGSCClientAsync(tenantId?: string): Promise<searchconsole_v1.Searchconsole> {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (client) return client;

  const creds = await getTenantCredentials(tenantId, "google_search_console");
  const email = creds?.client_email ?? getClientEmail();
  const pk = creds?.private_key ?? getPrivateKey();

  // Store site URL from DB credentials if available
  if (creds?.site_url) {
    _siteUrls.set(key, creds.site_url);
  }

  const auth = new google.auth.JWT({
    email,
    key: pk,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  client = google.searchconsole({ version: "v1", auth });
  _clients.set(key, client);
  return client;
}

export function getSiteUrl(tenantId?: string): string {
  // Site URL from DB-cached credentials (if already loaded by getGSCClientAsync)
  const key = tenantId ?? "default";
  const cached = _siteUrls.get(key);
  if (cached) return cached;
  return process.env.GSC_SITE_URL ?? "";
}

const _siteUrls = new Map<string, string>();

/** Store site URL from DB credentials when using async client. */
export function setSiteUrl(tenantId: string, siteUrl: string): void {
  _siteUrls.set(tenantId, siteUrl);
}
