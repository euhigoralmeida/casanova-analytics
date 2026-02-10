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

export function getGA4Client(): BetaAnalyticsDataClient {
  if (!_client) {
    _client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL!,
        private_key: process.env.GA4_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      },
    });
  }
  return _client;
}

export function getPropertyId(): string {
  return `properties/${process.env.GA4_PROPERTY_ID}`;
}
