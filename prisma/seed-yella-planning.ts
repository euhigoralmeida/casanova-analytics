/**
 * Seed script: inserts Yella Life planning data for JAN and FEV 2026.
 *
 * Run: npx tsx prisma/seed-yella-planning.ts
 *
 * Safe to run multiple times — uses upsert to avoid duplicates.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── JAN 2026 data (INPUT metrics only — calcs are computed client-side) ───
// Source: "Copia de METRICAS YELLA.xlsx - Planejamento Anual.csv"
const JAN_DATA: Record<string, number> = {
  // Receita & Custos
  receita_captada: 73430.81,
  custo_afiliado: 641.36,
  frete: 1349.10,
  voce_recebe: 54873.29,
  receita_faturada: 58704.70,
  receita_cancelada: 14726.11,
  // lucro_liquido → CALC: 54873.29 − 15901.29 = 38972.00
  // taxa_aprovacao_pedidos → CALC: 54873.29 / 73430.81 = 74.73%

  // Canais de Mídia — Google ADS
  google_ads: 275.00,
  google_ads_faturamento: 2819.99,
  google_ads_vendas: 8,
  // google_ads_roas → CALC: 2819.99 / 275.00 = 10.25

  // Canais de Mídia — Meta ADS
  meta_ads: 4426.29,
  meta_ads_faturamento: 20606.20,
  meta_ads_vendas: 65,
  // meta_ads_roas → CALC: 20606.20 / 4426.29 = 4.66

  // Influenciadores — Kamylla
  influ_kamylla_investimento: 3000.00,
  influ_kamylla_faturamento: 15569.50,
  influ_kamylla_vendas: 56,
  // influ_kamylla_roas → CALC: 15569.50 / 3000.00 = 5.19

  // Influenciadores — Sonia Matte
  influ_sonia_matte_investimento: 3200.00,
  influ_sonia_matte_faturamento: 1619.89,
  influ_sonia_matte_vendas: 4,
  // influ_sonia_matte_roas → CALC: 1619.89 / 3200.00 = 0.51

  // Influenciadores — Sophia Cit
  influ_sophia_cit_investimento: 5000.00,
  influ_sophia_cit_faturamento: 539.99,
  influ_sophia_cit_vendas: 2,
  // influ_sophia_cit_roas → CALC: 539.99 / 5000.00 = 0.11

  // Influenciadores — Fernanca Vancine (sem dados em JAN)
  // influ_fernanca_vancine: all zeros → omitted

  // Tráfego & Engajamento
  usuarios_visitantes: 7653,
  sessoes_totais: 9553,
  sessoes_midia: 8108,
  // sessoes_organicas: empty in CSV
  sessoes_engajadas: 2912,
  // taxa_engajamento → CALC: 2912 / 9553 = 30.48%
  taxa_rejeicao: 0.5505, // 55.05%

  // Pedidos & Carrinhos
  pedido_captado: 243,
  pedido_pago: 194,
  carrinhos_abandonados: 389,
  carrinhos_convertido: 217,
  // taxa_abandono_carrinho → CALC: 389 / (389+217) = 64.19%
  // taxa_conversao_carrinho → CALC: 217 / 389 = 55.78%

  // KPIs Finais — share_participacao: #REF! in CSV → omitted
};

// ─── FEV 2026 data ───
const FEV_DATA: Record<string, number> = {
  // Receita & Custos
  receita_captada: 92744.78,
  custo_afiliado: 1147.47,
  frete: 2134.88,
  voce_recebe: 60448.10,
  receita_faturada: 70449.12,
  receita_cancelada: 22295.66,
  // lucro_liquido → CALC: 60448.10 − 13824.26 = 46623.84
  // taxa_aprovacao_pedidos → CALC: 60448.10 / 92744.78 = 65.18%

  // Canais de Mídia — Google ADS
  google_ads: 210.44,
  google_ads_faturamento: 4765.27,
  google_ads_vendas: 17,
  // google_ads_roas → CALC: 4765.27 / 210.44 = 22.64

  // Canais de Mídia — Meta ADS
  meta_ads: 8113.82,
  meta_ads_faturamento: 21892.57,
  meta_ads_vendas: 76,
  // meta_ads_roas → CALC: 21892.57 / 8113.82 = 2.70

  // Influenciadores — Kamylla
  influ_kamylla_investimento: 4500.00,
  influ_kamylla_faturamento: 3167.22,
  influ_kamylla_vendas: 12,
  // influ_kamylla_roas → CALC: 3167.22 / 4500.00 = 0.70

  // Influenciadores — Sonia Matte (sem dados em FEV)
  // influ_sonia_matte: all zeros → omitted

  // Influenciadores — Sophia Cit (sem dados em FEV)
  // influ_sophia_cit: all zeros → omitted

  // Influenciadores — Fernanca Vancine
  influ_fernanca_vancine_investimento: 1000.00,
  // influ_fernanca_vancine_faturamento: 0 → omitted (zero revenue)
  // influ_fernanca_vancine_vendas: 0 → omitted

  // Tráfego & Engajamento
  usuarios_visitantes: 4792,
  sessoes_totais: 5658,
  // sessoes_midia: empty in CSV
  // sessoes_organicas: empty in CSV
  // sessoes_engajadas: empty in CSV
  // taxa_engajamento: CSV shows 74.16% but with empty sessoes_engajadas
  taxa_rejeicao: 0.2584, // 25.84%

  // Pedidos & Carrinhos
  pedido_captado: 322,
  pedido_pago: 246,
  carrinhos_abandonados: 452,
  carrinhos_convertido: 289,
  // taxa_abandono_carrinho → CALC: 452 / (452+289) = 61.00%
  // taxa_conversao_carrinho → CALC: 289 / 452 = 63.94%

  // KPIs Finais — share_participacao: #REF! in CSV → omitted
};

async function main() {
  console.log("🌱 Seeding Yella Life planning data...\n");

  // Find Yella tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: "yellalife" } });
  if (!tenant) {
    console.error("❌ Tenant 'yellalife' not found. Run seed-tenant.ts first.");
    process.exit(1);
  }
  console.log(`  Found tenant: ${tenant.name} (${tenant.id})`);

  const year = 2026;
  const planType = "actual";
  const source = "manual";

  const monthsData: { month: number; data: Record<string, number> }[] = [
    { month: 1, data: JAN_DATA },
    { month: 2, data: FEV_DATA },
  ];

  let totalEntries = 0;

  for (const { month, data } of monthsData) {
    const monthLabel = month === 1 ? "JAN" : "FEV";
    console.log(`\n  📅 ${monthLabel} ${year}:`);

    for (const [metric, value] of Object.entries(data)) {
      await prisma.planningEntry.upsert({
        where: {
          tenantId_year_month_metric_planType: {
            tenantId: tenant.id,
            year,
            month,
            metric,
            planType,
          },
        },
        update: { value, source },
        create: {
          tenantId: tenant.id,
          year,
          month,
          metric,
          value,
          source,
          planType,
        },
      });
      totalEntries++;
    }
    console.log(`    ✓ ${Object.keys(data).length} metrics upserted`);
  }

  console.log(`\n✅ Seed completed: ${totalEntries} total entries for Yella Life.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
