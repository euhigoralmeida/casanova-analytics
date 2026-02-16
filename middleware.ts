import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ca_session";

// Rotas públicas que não precisam de autenticação
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/ai-status"];

export function middleware(req: NextRequest) {
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

  // API sem auth → 401
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Páginas sem auth → redirect login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
