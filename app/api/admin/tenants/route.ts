import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPlatformAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  if (!isPlatformAdmin(auth.session)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        createdAt: true,
        _count: { select: { users: true, integrations: { where: { active: true } } } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tenants });
  } catch {
    return NextResponse.json({ tenants: [] });
  }
}

const SLUG_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  if (!isPlatformAdmin(auth.session)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: {
    name?: string;
    slug?: string;
    plan?: string;
    adminEmail?: string;
    adminName?: string;
    adminPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { name, slug, plan, adminEmail, adminName, adminPassword } = body;

  // Validate required fields
  if (!name || !slug) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }
  if (slug.length < 3 || slug.length > 30 || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Slug deve ter 3-30 caracteres, apenas letras minúsculas, números e hífens" },
      { status: 400 },
    );
  }
  if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
    return NextResponse.json({ error: "Email do admin é obrigatório e deve ser válido" }, { status: 400 });
  }

  const VALID_PLANS = ["starter", "pro", "enterprise"];
  if (plan && !VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: "Plano inválido. Use: starter, pro ou enterprise" },
      { status: 400 },
    );
  }

  if (adminPassword && adminPassword.length < 6) {
    return NextResponse.json(
      { error: "Senha deve ter no mínimo 6 caracteres" },
      { status: 400 },
    );
  }

  const password = adminPassword || crypto.randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          plan: plan || "pro",
        },
      });

      const user = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName || name,
          passwordHash,
          role: "admin",
          tenantId: tenant.id,
        },
      });

      return { tenant, user };
    });

    return NextResponse.json({
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        plan: result.tenant.plan,
      },
      user: {
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tempPassword: adminPassword ? undefined : password,
    });
  } catch (e) {
    if (e instanceof Error && e.message?.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 });
    }
    logger.error("Admin tenants POST error", { route: "/api/admin/tenants" }, e);
    return NextResponse.json({ error: "Erro ao criar tenant" }, { status: 500 });
  }
}
