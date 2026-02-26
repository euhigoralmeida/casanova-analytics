import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { checkApiLimit } from "@/lib/ai/rate-limiter";

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
 * Auth + rate limit in one call. Returns 401 if not authenticated, 429 if rate limited.
 */
export function requireAuthWithRateLimit(req: NextRequest, maxPerMinute: number = 120): AuthSuccess | AuthFailure {
  const auth = requireAuth(req);
  if ("error" in auth) return auth;

  const tenantId = getEffectiveTenantId(auth.session);
  if (!checkApiLimit(tenantId, maxPerMinute)) {
    return {
      error: NextResponse.json(
        { error: "Limite de requisições excedido. Tente novamente em alguns segundos." },
        { status: 429 },
      ),
    };
  }

  return auth;
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

/**
 * For data routes — returns tenantId or null if admin has no tenant selected.
 * Use this instead of getEffectiveTenantId for defense-in-depth.
 */
export function requireTenantContext(session: SessionPayload): string | null {
  if (session.globalRole === "platform_admin") {
    return session.activeTenantId || null;
  }
  return session.tenantId;
}

/**
 * Auth + platform_admin check in one call. Returns 401 or 403 on failure.
 */
export function requirePlatformAdmin(req: NextRequest): AuthSuccess | AuthFailure {
  const auth = requireAuth(req);
  if ("error" in auth) return auth;
  if (!isPlatformAdmin(auth.session)) {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return auth;
}
