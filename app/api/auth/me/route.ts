import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
  }

  const tenant = getTenant(session.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  const user = tenant.users.find((u) => u.email === session.email);

  return NextResponse.json({
    user: { email: session.email, name: user?.name ?? session.email, role: session.role },
    tenant: { id: tenant.id, name: tenant.name },
  });
}
