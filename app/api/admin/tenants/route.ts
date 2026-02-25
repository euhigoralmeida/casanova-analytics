import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPlatformAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  if (!isPlatformAdmin(auth.session)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true, logo: true, plan: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tenants });
  } catch {
    return NextResponse.json({ tenants: [] });
  }
}
