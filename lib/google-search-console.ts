import { google, searchconsole_v1 } from "googleapis";

/* =========================
   Configuracao GSC
========================= */

export function isGSCConfigured(): boolean {
  return !!(
    process.env.GSC_CLIENT_EMAIL &&
    (process.env.GSC_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY_BASE64) &&
    process.env.GSC_SITE_URL
  );
}

// Multi-tenant: Map de clients por tenantId
const _clients = new Map<string, searchconsole_v1.Searchconsole>();

function getPrivateKey(): string {
  // Option 1: Base64-encoded key (recommended for Vercel)
  if (process.env.GSC_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GSC_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  // Option 2: Raw key with possible escaped newlines
  const raw = process.env.GSC_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n").trim();
}

export function getGSCClient(tenantId?: string): searchconsole_v1.Searchconsole {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (!client) {
    const auth = new google.auth.JWT({
      email: process.env.GSC_CLIENT_EMAIL!,
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
