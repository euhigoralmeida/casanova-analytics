import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/tenants";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    const result = await authenticateUser(email, password);
    if (!result) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
    }

    const token = createSessionToken(result.tenant.id, result.user.email, result.user.role);

    const response = NextResponse.json({
      ok: true,
      user: { email: result.user.email, name: result.user.name, role: result.user.role },
      tenant: { id: result.tenant.id, name: result.tenant.name },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
