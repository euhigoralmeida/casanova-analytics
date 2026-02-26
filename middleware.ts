import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ca_session";

// Rotas públicas que não precisam de autenticação
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/cron/", "/api/health"];

type TokenPayload = {
  tenantId: string;
  email: string;
  role: string;
  globalRole?: string;
  activeTenantId?: string;
  exp: number;
};

/** Verify HMAC session token and decode payload (Edge-compatible) */
async function verifyAndDecode(token: string): Promise<TokenPayload | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const [encoded, hmac] = token.split(".");
  if (!encoded || !hmac) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (hmac !== expected) return null;

    const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as TokenPayload;
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir rotas públicas
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Permitir assets estáticos e _next
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.endsWith(".png") || pathname.endsWith(".ico")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyAndDecode(token) : null;

  // API routes: 401 se não autenticado
  if (pathname.startsWith("/api/")) {
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Páginas sem auth válido → redirect login
  if (!payload) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // /admin/* → bloquear se não é platform_admin
  if (pathname.startsWith("/admin")) {
    if (payload.globalRole !== "platform_admin") {
      return NextResponse.redirect(new URL("/overview", req.url));
    }
    return NextResponse.next();
  }

  // Rotas cliente → se admin sem activeTenantId, redirect /admin
  if (payload.globalRole === "platform_admin" && !payload.activeTenantId) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
