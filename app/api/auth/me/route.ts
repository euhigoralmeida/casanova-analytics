import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import { getEffectiveTenantId } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
  }

  const effectiveTenantId = getEffectiveTenantId(session);
  const tenant = await getTenant(effectiveTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  // For platform admins impersonating, look up user from their home tenant
  const homeTenant = session.activeTenantId
    ? await getTenant(session.tenantId)
    : tenant;
  const user = homeTenant?.users.find((u) => u.email === session.email);

  return NextResponse.json({
    user: {
      email: session.email,
      name: user?.name ?? session.email,
      role: session.role,
      globalRole: session.globalRole ?? null,
    },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    activeTenantId: session.activeTenantId ?? null,
  });
}
