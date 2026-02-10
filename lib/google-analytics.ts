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

let _client: BetaAnalyticsDataClient | null = null;

function getPrivateKey(): string {
  // Option 1: Base64-encoded key (recommended for Vercel)
  if (process.env.GA4_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  // Option 2: Raw key with possible escaped newlines
  const raw = process.env.GA4_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n").trim();
}

export function getGA4Client(): BetaAnalyticsDataClient {
  if (!_client) {
    _client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL!,
        private_key: getPrivateKey(),
      },
    });
  }
  return _client;
}

export function getPropertyId(): string {
  return `properties/${process.env.GA4_PROPERTY_ID}`;
}
