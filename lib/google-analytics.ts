import { BetaAnalyticsDataClient } from "@google-analytics/data";

/* =========================
   Configuração GA4
========================= */

export function isGA4Configured(): boolean {
  return !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_CLIENT_EMAIL &&
    process.env.GA4_PRIVATE_KEY
  );
}

let _client: BetaAnalyticsDataClient | null = null;

function parsePrivateKey(raw: string): string {
  // Handle multiple formats: literal \n, escaped \\n, or real newlines
  let key = raw.replace(/\\n/g, "\n");
  // If still no real newlines, try double-escaped
  if (!key.includes("\n")) {
    key = key.replace(/\\\\n/g, "\n");
  }
  return key.trim();
}

export function getGA4Client(): BetaAnalyticsDataClient {
  if (!_client) {
    const privateKey = parsePrivateKey(process.env.GA4_PRIVATE_KEY!);
    _client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL!,
        private_key: privateKey,
      },
    });
  }
  return _client;
}

export function getPropertyId(): string {
  return `properties/${process.env.GA4_PROPERTY_ID}`;
}
