import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/tenants";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { isRateLimited, recordFailedAttempt, clearRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    // Rate limit by IP + email
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitKey = `${ip}:${email.toLowerCase()}`;

    const limit = isRateLimited(rateLimitKey);
    if (limit.blocked) {
      const retryMinutes = Math.ceil((limit.retryAfterMs ?? 0) / 60000);
      logger.warn("Login rate limited", { route: "/api/auth/login", ip, email });
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${retryMinutes} minuto(s).` },
        { status: 429 },
      );
    }

    const result = await authenticateUser(email, password);
    if (!result) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
    }

    // Success — clear rate limit
    clearRateLimit(rateLimitKey);

    const token = createSessionToken(result.tenant.id, result.user.email, result.user.role, {
      globalRole: result.user.globalRole,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        globalRole: result.user.globalRole ?? null,
      },
      tenant: { id: result.tenant.id, name: result.tenant.name, logo: result.tenant.logo ?? null },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    logger.error("Login error", { route: "/api/auth/login" }, err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
