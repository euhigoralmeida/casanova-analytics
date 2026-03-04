import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireTenantContext } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";

const INFLU_NAME_PREFIX = "influ_name:";

/**
 * GET /api/planning/influ-names
 * Returns { names: { "influ_influ_5_nome": "Maria", ... } }
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const tenantId = requireTenantContext(session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const settings = await prisma.tenantSetting.findMany({
    where: {
      tenantId,
      key: { startsWith: INFLU_NAME_PREFIX },
    },
  });

  const names: Record<string, string> = {};
  for (const s of settings) {
    const labelKey = s.key.slice(INFLU_NAME_PREFIX.length);
    names[labelKey] = s.value;
  }

  return NextResponse.json({ names });
}

/**
 * PUT /api/planning/influ-names
 * Body: { names: { "influ_influ_5_nome": "Maria", ... } }
 */
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  if (session.role !== "admin" && session.globalRole !== "platform_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }
  const tenantId = requireTenantContext(session);
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  }

  const body = await req.json();
  const { names } = body as { names: Record<string, string> };

  if (!names || typeof names !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const entries = Object.entries(names).filter(
    ([key, val]) => typeof key === "string" && typeof val === "string" && key.startsWith("influ_")
  );

  await prisma.$transaction(
    entries.map(([key, value]) =>
      value.trim()
        ? prisma.tenantSetting.upsert({
            where: { tenantId_key: { tenantId, key: `${INFLU_NAME_PREFIX}${key}` } },
            update: { value: value.trim() },
            create: { tenantId, key: `${INFLU_NAME_PREFIX}${key}`, value: value.trim() },
          })
        : prisma.tenantSetting.deleteMany({
            where: { tenantId, key: `${INFLU_NAME_PREFIX}${key}` },
          })
    )
  );

  return NextResponse.json({ ok: true });
}
