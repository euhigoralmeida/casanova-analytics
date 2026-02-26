import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const tenantId = requireTenantContext(session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  try {
    const members = await prisma.user.findMany({
      where: { tenant: { OR: [{ id: tenantId }, { slug: tenantId }] }, active: true },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ members: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const tenantId = requireTenantContext(session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  try {
    const { email, name, role } = await req.json();
    if (!email || !name) {
      return NextResponse.json({ error: "Email e nome são obrigatórios" }, { status: 400 });
    }

    // Find the tenant
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email },
    });
    if (existing) {
      return NextResponse.json({ error: "Usuário já existe neste tenant" }, { status: 409 });
    }

    // Create with a temporary password (user must reset)
    const tempPassword = crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role ?? "viewer",
        passwordHash,
        tenantId: tenant.id,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user, tempPassword });
  } catch (e) {
    console.error("Team create error:", e);
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
