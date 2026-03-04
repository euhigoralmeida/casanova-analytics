import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPlatformAdmin } from "@/lib/api-helpers";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { tenantId } = await req.json();
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 });
  }

  // Verify tenant exists
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  // Re-issue token with the new activeTenantId (always use the resolved DB ID)
  // If switching back to own tenant, clear activeTenantId
  const activeTenantId = tenant.id === session.tenantId ? undefined : tenant.id;

  const token = createSessionToken(session.tenantId, session.email, session.role, {
    globalRole: session.globalRole,
    activeTenantId,
  });

  const response = NextResponse.json({
    ok: true,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logo: tenant.logo ?? null },
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
