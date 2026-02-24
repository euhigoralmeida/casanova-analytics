import { google, searchconsole_v1 } from "googleapis";

/* =========================
   Configuracao GSC
========================= */

export function isGSCConfigured(): boolean {
  const hasGSCCreds = !!(
    process.env.GSC_CLIENT_EMAIL &&
    (process.env.GSC_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY_BASE64)
  );
  // Fallback: use GA4 service account credentials if GSC-specific ones are missing
  const hasGA4Creds = !!(
    process.env.GA4_CLIENT_EMAIL &&
    (process.env.GA4_PRIVATE_KEY || process.env.GA4_PRIVATE_KEY_BASE64)
  );
  return !!(process.env.GSC_SITE_URL && (hasGSCCreds || hasGA4Creds));
}

// Multi-tenant: Map de clients por tenantId
const _clients = new Map<string, searchconsole_v1.Searchconsole>();

function getPrivateKey(): string {
  // Option 1: GSC-specific Base64 key
  if (process.env.GSC_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GSC_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  // Option 2: GSC-specific raw key
  if (process.env.GSC_PRIVATE_KEY) {
    return process.env.GSC_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
  }
  // Option 3: Fallback to GA4 key (same GCP project)
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

export function getSiteUrl(): string {
  return process.env.GSC_SITE_URL ?? "";
}
