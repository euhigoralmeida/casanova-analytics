import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireTenantContext } from "@/lib/api-helpers";
import {
  getTenantCredentials,
  invalidateCredentialsCache,
  type Platform,
} from "@/lib/tenant-credentials";
import { encryptCredentials } from "@/lib/secrets";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const PLATFORMS: Platform[] = [
  "google_ads",
  "ga4",
  "meta_ads",
  "google_search_console",
  "clarity",
  "instagram",
  "magazord",
];

const REQUIRED_FIELDS: Record<Platform, string[]> = {
  google_ads: ["developer_token", "client_id", "client_secret", "refresh_token", "customer_id"],
  ga4: ["property_id", "client_email", "private_key"],
  meta_ads: ["access_token", "account_id"],
  clarity: ["project_id", "api_token"],
  google_search_console: ["site_url", "client_email", "private_key"],
  instagram: ["access_token", "business_account_id"],
  magazord: ["username", "password"],
};

/**
 * Returns the connection status of each integration platform.
 * Checks DB credentials first (per tenant), then falls back to env vars.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const integrations = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const creds = await getTenantCredentials(tenantId, platform);
      return {
        platform,
        connected: !!creds,
      };
    }),
  );

  return NextResponse.json({ integrations });
}

/**
 * Save encrypted credentials for a platform integration.
 * Requires admin role.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  if (auth.session.role !== "admin" && auth.session.globalRole !== "platform_admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  let body: { platform?: string; credentials?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { platform, credentials } = body;

  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json(
      { error: `Plataforma inválida. Use: ${PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }

  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json({ error: "Credenciais são obrigatórias" }, { status: 400 });
  }

  const required = REQUIRED_FIELDS[platform as Platform];
  const missing = required.filter((k) => !credentials[k]?.trim());
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Campos obrigatórios ausentes: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      normalized[key] = key === "private_key"
        ? value.replace(/^\s+|\s+$/g, "")
        : value.trim();
    }
    const encrypted = encryptCredentials(normalized);

    await prisma.integration.upsert({
      where: { tenantId_platform: { tenantId, platform } },
      update: { credentials: encrypted, active: true, updatedAt: new Date() },
      create: { tenantId, platform, credentials: encrypted, active: true },
    });

    invalidateCredentialsCache(tenantId, platform as Platform);

    return NextResponse.json({ ok: true, platform });
  } catch (e) {
    logger.error("Settings integrations POST error", { route: "/api/settings/integrations", tenantId }, e);
    const msg = e instanceof Error ? e.message : String(e);
    // Expose error class for debugging without leaking secrets
    const hint = msg.includes("Foreign key")
      ? " (tenant não encontrado no banco)"
      : msg.includes("CREDENTIALS_ENCRYPTION_KEY")
        ? " (chave de criptografia não configurada)"
        : "";
    return NextResponse.json({ error: `Erro ao salvar credenciais${hint}` }, { status: 500 });
  }
}

/**
 * Remove (deactivate) credentials for a platform integration.
 * Requires admin role.
 */
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  if (auth.session.role !== "admin" && auth.session.globalRole !== "platform_admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const tenantId = requireTenantContext(auth.session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  let body: { platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { platform } = body;

  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }

  try {
    await prisma.integration.updateMany({
      where: { tenantId, platform },
      data: { active: false },
    });

    invalidateCredentialsCache(tenantId, platform as Platform);

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("Settings integrations DELETE error", { route: "/api/settings/integrations", tenantId }, e);
    return NextResponse.json({ error: "Erro ao remover integração" }, { status: 500 });
  }
}
