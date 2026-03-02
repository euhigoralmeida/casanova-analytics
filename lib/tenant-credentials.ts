import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/secrets";

export type Platform =
  | "google_ads"
  | "ga4"
  | "meta_ads"
  | "google_search_console"
  | "clarity"
  | "instagram";

// Cache decrypted credentials in-memory for 2 min per tenant+platform
const cache = new Map<string, { data: Record<string, string>; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000;

// Legacy tenants that are allowed to use env var credentials.
// Only the original Casanova tenant (and "default" for backward compat) should fall back to env vars.
// All new tenants MUST have DB credentials or they get no data.
const LEGACY_ENV_TENANT_SLUGS = new Set(["casanova", "default"]);

// Cache tenant slug lookups (tenantId → slug) to avoid repeated DB queries
const slugCache = new Map<string, { slug: string | null; ts: number }>();

async function isLegacyEnvTenant(tenantId: string): Promise<boolean> {
  // Direct match on slug/id (backward compat when DB is down or tenantId is a slug)
  if (LEGACY_ENV_TENANT_SLUGS.has(tenantId)) return true;

  // Resolve slug from DB (with cache)
  const cached = slugCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.slug ? LEGACY_ENV_TENANT_SLUGS.has(cached.slug) : false;
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { slug: true },
    });
    slugCache.set(tenantId, { slug: tenant?.slug ?? null, ts: Date.now() });
    return tenant?.slug ? LEGACY_ENV_TENANT_SLUGS.has(tenant.slug) : false;
  } catch {
    return false;
  }
}

/**
 * Fetch credentials for a tenant+platform.
 * 1. Check DB (Integration table) — decrypt if found
 * 2. Fall back to env vars ONLY for legacy tenants (casanova)
 *
 * Returns null if tenant has no configured credentials.
 */
export async function getTenantCredentials(
  tenantId: string | undefined,
  platform: Platform,
): Promise<Record<string, string> | null> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:${platform}`;

  // Check memory cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Try DB if encryption key exists
  if (process.env.CREDENTIALS_ENCRYPTION_KEY) {
    try {
      const integration = await prisma.integration.findUnique({
        where: { tenantId_platform: { tenantId: tid, platform } },
      });
      if (integration?.active && integration.credentials) {
        const creds = decryptCredentials<Record<string, string>>(integration.credentials);
        cache.set(cacheKey, { data: creds, ts: Date.now() });
        return creds;
      }
    } catch (e) {
      console.warn(`[tenant-credentials] DB lookup failed for ${tid}/${platform}:`, e);
    }
  }

  // Env var fallback ONLY for legacy tenants — new tenants get null (no data leak)
  if (await isLegacyEnvTenant(tid)) {
    const envCreds = getEnvCredentials(platform);
    if (envCreds) {
      cache.set(cacheKey, { data: envCreds, ts: Date.now() });
    }
    return envCreds;
  }

  return null;
}

/**
 * Fallback: read credentials from environment variables (existing behavior).
 */
function getEnvCredentials(platform: Platform): Record<string, string> | null {
  switch (platform) {
    case "google_ads": {
      if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return null;
      return {
        client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
        customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID ?? "",
        login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "",
      };
    }
    case "ga4": {
      if (!process.env.GA4_PROPERTY_ID) return null;
      const privateKey = process.env.GA4_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8")
        : (process.env.GA4_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
      return {
        property_id: process.env.GA4_PROPERTY_ID ?? "",
        client_email: process.env.GA4_CLIENT_EMAIL ?? "",
        private_key: privateKey,
      };
    }
    case "meta_ads": {
      if (!process.env.META_ADS_ACCESS_TOKEN) return null;
      return {
        access_token: process.env.META_ADS_ACCESS_TOKEN ?? "",
        account_id: process.env.META_ADS_ACCOUNT_ID ?? "",
      };
    }
    case "google_search_console": {
      if (!process.env.GSC_SITE_URL) return null;
      const gscKey = process.env.GSC_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.GSC_PRIVATE_KEY_BASE64, "base64").toString("utf-8")
        : process.env.GSC_PRIVATE_KEY
          ? process.env.GSC_PRIVATE_KEY.replace(/\\n/g, "\n").trim()
          : process.env.GA4_PRIVATE_KEY_BASE64
            ? Buffer.from(process.env.GA4_PRIVATE_KEY_BASE64, "base64").toString("utf-8")
            : (process.env.GA4_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
      return {
        site_url: process.env.GSC_SITE_URL ?? "",
        client_email: process.env.GSC_CLIENT_EMAIL ?? process.env.GA4_CLIENT_EMAIL ?? "",
        private_key: gscKey,
      };
    }
    case "clarity": {
      if (!process.env.CLARITY_PROJECT_ID) return null;
      return {
        project_id: process.env.CLARITY_PROJECT_ID ?? "",
        api_token: process.env.CLARITY_API_TOKEN ?? "",
      };
    }
    case "instagram": {
      if (!process.env.META_ADS_ACCESS_TOKEN) return null;
      return {
        access_token: process.env.META_ADS_ACCESS_TOKEN ?? "",
        business_account_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "",
      };
    }
    default:
      return null;
  }
}

/** Invalidate cached credentials for a tenant+platform (e.g., after update). */
export function invalidateCredentialsCache(tenantId: string, platform?: Platform): void {
  if (platform) {
    cache.delete(`${tenantId}:${platform}`);
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) cache.delete(key);
    }
  }
}
