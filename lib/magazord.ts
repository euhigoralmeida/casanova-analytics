/**
 * Magazord API Client — BasicAuth, auto-pagination, cache
 *
 * Env vars (legacy fallback): MAGAZORD_USERNAME, MAGAZORD_PASSWORD, MAGAZORD_BASE_URL
 * Multi-tenant: loads from DB via getTenantCredentials.
 */

import { getTenantCredentials } from "@/lib/tenant-credentials";
import { logger } from "@/lib/logger";

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const PAGE_DELAY = 100; // ms between paginated requests
const PAGE_LIMIT = 100;

// ---------- Credentials ----------

export type MagazordCredentials = {
  username: string;
  password: string;
  baseUrl: string;
};

export async function getMagazordCredentials(
  tenantId?: string,
): Promise<MagazordCredentials | null> {
  const creds = await getTenantCredentials(tenantId, "magazord");
  if (!creds) return null;
  return {
    username: creds.username,
    password: creds.password,
    baseUrl: creds.base_url || "https://api.magazord.com.br",
  };
}

// ---------- Cache ----------

const cache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------- Fetch with auto-pagination ----------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function magazordFetch<T>(
  path: string,
  params: Record<string, string>,
  creds: MagazordCredentials,
): Promise<T[]> {
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
  const allData: T[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${creds.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("Magazord API error", { route: "lib/magazord", statusCode: res.status }, body);
      throw new Error(`Magazord API ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    // API returns { data: { items: [...], has_more: bool } } or { data: [...] }
    const rawData = json.data;
    const data: T[] = Array.isArray(rawData) ? rawData : (rawData?.items ?? []);
    allData.push(...data);

    // Stop if no more pages
    const hasMore = !Array.isArray(rawData) && rawData?.has_more === true;
    if (data.length < PAGE_LIMIT || !hasMore) break;

    page++;
    await sleep(PAGE_DELAY);
  }

  return allData;
}

export { getCached as getMagazordCached, setCache as setMagazordCache };
