import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/secrets";
import { logger } from "@/lib/logger";

type IntegrationHealth = {
  platform: string;
  status: "ok" | "error" | "unconfigured";
  message?: string;
  checkedAt: string;
};

type TenantHealth = {
  tenantId: string;
  tenantName: string;
  slug: string;
  integrations: IntegrationHealth[];
};

/**
 * GET /api/admin/health?tenantId=xxx (optional)
 * Tests integration credentials for tenants.
 * If tenantId is provided, checks only that tenant; otherwise checks all active tenants.
 */
export async function GET(req: NextRequest) {
  const auth = requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const specificTenantId = req.nextUrl.searchParams.get("tenantId");

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        active: true,
        ...(specificTenantId ? { id: specificTenantId } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        integrations: {
          where: { active: true },
          select: {
            platform: true,
            credentials: true,
            lastSyncAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const results: TenantHealth[] = [];

    for (const tenant of tenants) {
      const integrationResults: IntegrationHealth[] = [];

      for (const integration of tenant.integrations) {
        const health = await checkIntegration(integration.platform, integration.credentials);
        integrationResults.push({
          ...health,
          checkedAt: new Date().toISOString(),
        });
      }

      // Also flag expected integrations that are missing
      const configuredPlatforms = new Set(tenant.integrations.map((i) => i.platform));
      const corePlatforms = ["google_ads", "ga4"];
      for (const platform of corePlatforms) {
        if (!configuredPlatforms.has(platform)) {
          integrationResults.push({
            platform,
            status: "unconfigured",
            message: "Integração não configurada",
            checkedAt: new Date().toISOString(),
          });
        }
      }

      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        slug: tenant.slug,
        integrations: integrationResults,
      });
    }

    return NextResponse.json({ tenants: results, checkedAt: new Date().toISOString() });
  } catch (e) {
    logger.error("Admin health check error", { route: "/api/admin/health" }, e);
    return NextResponse.json({ error: "Erro ao verificar saúde das integrações" }, { status: 500 });
  }
}

async function checkIntegration(
  platform: string,
  encryptedCredentials: string,
): Promise<Omit<IntegrationHealth, "checkedAt">> {
  try {
    const creds = decryptCredentials<Record<string, string>>(encryptedCredentials);

    switch (platform) {
      case "google_ads":
        return checkGoogleAds(creds);
      case "ga4":
        return checkGA4(creds);
      case "meta_ads":
        return checkMetaAds(creds);
      case "google_search_console":
        return { platform, status: "ok", message: "Credenciais presentes (service account)" };
      case "instagram":
        return checkInstagram(creds);
      case "clarity":
        return { platform, status: "ok", message: "Credenciais presentes" };
      default:
        return { platform, status: "ok", message: "Plataforma não verificada" };
    }
  } catch (e) {
    return {
      platform,
      status: "error",
      message: `Erro ao descriptografar credenciais: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }
}

async function checkGoogleAds(creds: Record<string, string>): Promise<Omit<IntegrationHealth, "checkedAt">> {
  const required = ["client_id", "client_secret", "developer_token", "refresh_token", "customer_id"];
  const missing = required.filter((k) => !creds[k]);
  if (missing.length > 0) {
    return { platform: "google_ads", status: "error", message: `Campos faltando: ${missing.join(", ")}` };
  }

  // Lightweight token validation via OAuth2 token info endpoint
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return { platform: "google_ads", status: "error", message: `Token inválido/expirado: ${body.slice(0, 150)}` };
    }
    return { platform: "google_ads", status: "ok", message: "Refresh token válido" };
  } catch (e) {
    return { platform: "google_ads", status: "error", message: `Erro de rede: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

async function checkGA4(creds: Record<string, string>): Promise<Omit<IntegrationHealth, "checkedAt">> {
  const required = ["client_email", "private_key", "property_id"];
  const missing = required.filter((k) => !creds[k]);
  if (missing.length > 0) {
    return { platform: "ga4", status: "error", message: `Campos faltando: ${missing.join(", ")}` };
  }
  return { platform: "ga4", status: "ok", message: "Service account configurado" };
}

async function checkMetaAds(creds: Record<string, string>): Promise<Omit<IntegrationHealth, "checkedAt">> {
  if (!creds.access_token || !creds.account_id) {
    return { platform: "meta_ads", status: "error", message: "access_token ou account_id faltando" };
  }

  // Lightweight check: hit the /me endpoint
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${creds.access_token}&fields=id,name`,
    );
    if (!res.ok) {
      const body = await res.text();
      return { platform: "meta_ads", status: "error", message: `Token inválido: ${body.slice(0, 150)}` };
    }
    return { platform: "meta_ads", status: "ok", message: "Access token válido" };
  } catch (e) {
    return { platform: "meta_ads", status: "error", message: `Erro de rede: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

async function checkInstagram(creds: Record<string, string>): Promise<Omit<IntegrationHealth, "checkedAt">> {
  if (!creds.access_token) {
    return { platform: "instagram", status: "error", message: "access_token faltando" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${creds.access_token}&fields=id`,
    );
    if (!res.ok) {
      return { platform: "instagram", status: "error", message: "Token inválido/expirado" };
    }
    return { platform: "instagram", status: "ok", message: "Access token válido" };
  } catch {
    return { platform: "instagram", status: "error", message: "Erro de rede" };
  }
}
