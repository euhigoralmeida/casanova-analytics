import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/* =========================
   GET /api/settings/sku-master
   Lista todos os SKUs cadastrados do tenant
========================= */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const skus = await prisma.skuMaster.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sku: "asc" },
  });

  return NextResponse.json({ skus });
}

/* =========================
   PUT /api/settings/sku-master
   Upsert de SKUs (batch)
   Body: { skus: [{ sku, nome, marginPct, stock, costOfGoods?, category? }] }
========================= */
export async function PUT(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const skuList = body.skus as {
    sku: string;
    nome: string;
    marginPct: number;
    stock: number;
    costOfGoods?: number;
    category?: string;
  }[];

  if (!Array.isArray(skuList) || skuList.length === 0) {
    return NextResponse.json({ error: "Lista de SKUs inválida" }, { status: 400 });
  }

  // Upsert each SKU
  const results = await Promise.all(
    skuList.map((s) =>
      prisma.skuMaster.upsert({
        where: { tenantId_sku: { tenantId: session.tenantId, sku: s.sku } },
        create: {
          tenantId: session.tenantId,
          sku: s.sku,
          nome: s.nome,
          marginPct: s.marginPct,
          stock: s.stock,
          costOfGoods: s.costOfGoods ?? null,
          category: s.category ?? null,
        },
        update: {
          nome: s.nome,
          marginPct: s.marginPct,
          stock: s.stock,
          costOfGoods: s.costOfGoods ?? null,
          category: s.category ?? null,
        },
      })
    )
  );

  return NextResponse.json({ ok: true, count: results.length });
}

/* =========================
   DELETE /api/settings/sku-master?sku=...
   Remove um SKU
========================= */
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku) {
    return NextResponse.json({ error: "SKU não informado" }, { status: 400 });
  }

  try {
    await prisma.skuMaster.delete({
      where: { tenantId_sku: { tenantId: session.tenantId, sku } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "SKU não encontrado" }, { status: 404 });
  }
}
