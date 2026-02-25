import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";

type AuthSuccess = { session: SessionPayload };
type AuthFailure = { error: NextResponse };

/**
 * Validate session cookie on API routes. Returns session on success, or a 401 response on failure.
 */
export function requireAuth(req: NextRequest): AuthSuccess | AuthFailure {
  const session = getSession(req);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

/**
 * Returns the effective tenant ID — for platform admins who are impersonating
 * a client, this returns the activeTenantId. Otherwise, their own tenantId.
 */
export function getEffectiveTenantId(session: SessionPayload): string {
  if (session.globalRole === "platform_admin" && session.activeTenantId) {
    return session.activeTenantId;
  }
  return session.tenantId;
}

export function isPlatformAdmin(session: SessionPayload): boolean {
  return session.globalRole === "platform_admin";
}
