import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ca_session";

// Rotas públicas que não precisam de autenticação
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout"];

/** Verify HMAC session token using Web Crypto API (Edge-compatible) */
async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const [encoded, hmac] = token.split(".");
  if (!encoded || !hmac) return false;

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

    if (hmac !== expected) return false;

    // Check expiry
    const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Date.now()) return false;

    return true;
  } catch {
    return false;
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

  // Verificar assinatura HMAC do cookie
  const valid = token ? await verifyToken(token) : false;

  if (pathname.startsWith("/api/")) {
    if (!valid) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Páginas sem auth válido → redirect login
  if (!valid) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
