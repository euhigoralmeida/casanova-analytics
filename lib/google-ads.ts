import { GoogleAdsApi, Customer } from "google-ads-api";

/* =========================
   Configuração
========================= */

export function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

let _client: GoogleAdsApi | null = null;

function getClient(): GoogleAdsApi {
  if (!_client) {
    _client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });
  }
  return _client;
}

export function getCustomer(): Customer {
  const client = getClient();
  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });
}

/* =========================
   Date clause builder
========================= */

export function buildDateClause(period: string, startDate?: string, endDate?: string): string {
  // Sempre usar BETWEEN com datas explícitas para garantir alinhamento exato
  if (startDate && endDate) {
    return `segments.date BETWEEN '${startDate}' AND '${endDate}'`;
  }

  // Fallback: calcular datas a partir do period string (não deve ser usado normalmente)
  const today = localDateStr();
  const yesterday = localDateStr(-1);

  const presetDates: Record<string, { start: string; end: string }> = {
    today: { start: today, end: today },
    yesterday: { start: yesterday, end: yesterday },
    "7d": { start: localDateStr(-6), end: today },
    "14d": { start: localDateStr(-13), end: today },
    "30d": { start: localDateStr(-29), end: today },
    this_month: { start: `${today.slice(0, 8)}01`, end: today },
    last_month: (() => {
      const now = new Date();
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmtLocalDate(firstLastMonth), end: fmtLocalDate(lastLastMonth) };
    })(),
  };

  if (presetDates[period]) {
    const { start, end } = presetDates[period];
    return `segments.date BETWEEN '${start}' AND '${end}'`;
  }

  // Genérico: "60d", "90d", etc
  const days = parseInt(period.replace("d", ""), 10) || 30;
  return `segments.date BETWEEN '${localDateStr(-(days - 1))}' AND '${today}'`;
}

function localDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return fmtLocalDate(d);
}

export function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =========================
   Comparison period helper
========================= */

export function computeComparisonDates(startDate: string, endDate: string) {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daySpan + 1);
  return { prevStart: fmtLocalDate(prevStart), prevEnd: fmtLocalDate(prevEnd) };
}

/* =========================
   Cache simples (in-memory)
========================= */

const TTL = 2 * 60 * 1000; // 2 minutos

const cache = new Map<string, { data: unknown; ts: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}
