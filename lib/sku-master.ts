/* =========================
   SKU Master — Leitura de dados de margem/estoque do banco
   Substitui os hardcodes de skuExtras nos API routes
========================= */

import { prisma } from "@/lib/db";

export type SkuExtras = {
  nome: string;
  marginPct: number;
  stock: number;
  costOfGoods: number | null;
  category: string | null;
};

// Fallback hardcoded (usado se banco não tem dados)
const FALLBACK_EXTRAS: Record<string, SkuExtras> = {
  "27290BR-CP": { nome: "Torneira Cozinha CP", marginPct: 35, stock: 42, costOfGoods: null, category: null },
  "31450BR-LX": { nome: "Ducha Luxo LX", marginPct: 22, stock: 6, costOfGoods: null, category: null },
  "19820BR-ST": { nome: "Misturador ST", marginPct: 28, stock: 18, costOfGoods: null, category: null },
};

/**
 * Carrega dados de SKU do banco (SkuMaster) com fallback para hardcoded.
 * Retorna um Map de sku → extras.
 */
export async function loadSkuExtras(tenantId: string): Promise<Record<string, SkuExtras>> {
  try {
    const rows = await prisma.skuMaster.findMany({
      where: { tenantId },
    });

    if (rows.length === 0) {
      return FALLBACK_EXTRAS;
    }

    const map: Record<string, SkuExtras> = {};
    for (const row of rows) {
      map[row.sku] = {
        nome: row.nome,
        marginPct: row.marginPct,
        stock: row.stock,
        costOfGoods: row.costOfGoods,
        category: row.category,
      };
    }
    return map;
  } catch {
    return FALLBACK_EXTRAS;
  }
}
