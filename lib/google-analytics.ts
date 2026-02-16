import { BetaAnalyticsDataClient } from "@google-analytics/data";

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

function getPrivateKey(): string {
  // Option 1: Base64-encoded key (recommended for Vercel)
  if (process.env.GA4_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  // Option 2: Raw key with possible escaped newlines
  const raw = process.env.GA4_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n").trim();
}

export function getGA4Client(tenantId?: string): BetaAnalyticsDataClient {
  const key = tenantId ?? "default";
  let client = _clients.get(key);
  if (!client) {
    // V1: todos os tenants usam as mesmas credenciais do .env
    // V1.5: buscar credenciais do tenant via getTenantConfig(tenantId)
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

export function getPropertyId(tenantId?: string): string {
  // V1: todos usam o mesmo property do .env
  // V1.5: buscar property do tenant
  void tenantId;
  return `properties/${process.env.GA4_PROPERTY_ID}`;
}
