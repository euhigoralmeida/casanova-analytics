import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPlatformAdmin } from "@/lib/api-helpers";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Re-issue token WITHOUT activeTenantId
  const token = createSessionToken(session.tenantId, session.email, session.role, {
    globalRole: session.globalRole,
  });

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
