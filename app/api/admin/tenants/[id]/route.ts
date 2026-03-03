import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            globalRole: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        integrations: {
          select: {
            id: true,
            platform: true,
            label: true,
            active: true,
            lastSyncAt: true,
            createdAt: true,
          },
          orderBy: { platform: "asc" },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (e) {
    logger.error("Admin tenant detail GET error", { route: "/api/admin/tenants/[id]", tenantId: id }, e);
    return NextResponse.json({ error: "Erro ao carregar tenant" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let body: {
    name?: string;
    plan?: string;
    logo?: string;
    active?: boolean;
    primaryColor?: string | null;
    onboardingStatus?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const VALID_PLANS = ["starter", "pro", "enterprise"];
  if (body.plan && !VALID_PLANS.includes(body.plan)) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }

  const VALID_ONBOARDING = ["pending", "integrations", "complete"];
  if (body.onboardingStatus && !VALID_ONBOARDING.includes(body.onboardingStatus)) {
    return NextResponse.json({ error: "Status de onboarding inválido" }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.plan !== undefined && { plan: body.plan }),
        ...(body.logo !== undefined && { logo: body.logo }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
        ...(body.onboardingStatus !== undefined && { onboardingStatus: body.onboardingStatus }),
      },
    });

    return NextResponse.json({ tenant });
  } catch (e) {
    logger.error("Admin tenant detail PATCH error", { route: "/api/admin/tenants/[id]", tenantId: id }, e);
    return NextResponse.json({ error: "Erro ao atualizar tenant" }, { status: 500 });
  }
}
