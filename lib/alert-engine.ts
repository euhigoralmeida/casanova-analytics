import type { SmartAlert } from "./alert-types";
import type { AccountTotals, CampaignMetrics, SkuMetrics, DailyMetrics } from "./queries";
import type { RetentionSummary } from "./ga4-queries";

/* =========================
   Helpers
========================= */

function pctDelta(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number): string {
  return `${Math.abs(Math.round(v))}%`;
}

/* =========================
   Alertas de Conta
========================= */

function computeAccountAlerts(current: AccountTotals, previous: AccountTotals): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // ROAS
  const curRoas = current.costBRL > 0 ? current.revenue / current.costBRL : 0;
  const prevRoas = previous.costBRL > 0 ? previous.revenue / previous.costBRL : 0;
  const roasDelta = pctDelta(curRoas, prevRoas);

  if (roasDelta <= -20) {
    alerts.push({
      id: "acct-roas-drop",
      category: "account",
      severity: "danger",
      title: `ROAS da conta caiu ${fmtPct(roasDelta)} vs período anterior`,
      description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
      metric: "ROAS",
      currentValue: Math.round(curRoas * 100) / 100,
      previousValue: Math.round(prevRoas * 100) / 100,
      deltaPct: Math.round(roasDelta),
      recommendation: "Revise as campanhas com pior desempenho e considere pausar as de ROAS mais baixo",
    });
  } else if (roasDelta <= -10) {
    alerts.push({
      id: "acct-roas-warn",
      category: "account",
      severity: "warn",
      title: `ROAS da conta em queda: ${fmtPct(roasDelta)} abaixo do período anterior`,
      description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
      metric: "ROAS",
      currentValue: Math.round(curRoas * 100) / 100,
      previousValue: Math.round(prevRoas * 100) / 100,
      deltaPct: Math.round(roasDelta),
      recommendation: "Monitore diariamente e avalie ajustar lances",
    });
  } else if (roasDelta >= 20) {
    alerts.push({
      id: "acct-roas-up",
      category: "account",
      severity: "success",
      title: `ROAS da conta subiu ${fmtPct(roasDelta)} vs período anterior`,
      description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
      metric: "ROAS",
      currentValue: Math.round(curRoas * 100) / 100,
      previousValue: Math.round(prevRoas * 100) / 100,
      deltaPct: Math.round(roasDelta),
    });
  }

  // Gasto
  const spendDelta = pctDelta(current.costBRL, previous.costBRL);
  if (spendDelta >= 40) {
    alerts.push({
      id: "acct-spend-spike",
      category: "account",
      severity: "warn",
      title: `Gasto total da conta subiu ${fmtPct(spendDelta)}`,
      description: `Gasto atual: ${fmtBRL(current.costBRL)} vs anterior: ${fmtBRL(previous.costBRL)}.`,
      metric: "spend",
      currentValue: Math.round(current.costBRL * 100) / 100,
      previousValue: Math.round(previous.costBRL * 100) / 100,
      deltaPct: Math.round(spendDelta),
      recommendation: "Verifique se orçamentos foram alterados ou se há campanhas novas consumindo verba",
    });
  }

  // Taxa de conversão
  const curCR = current.clicks > 0 ? (current.conversions / current.clicks) * 100 : 0;
  const prevCR = previous.clicks > 0 ? (previous.conversions / previous.clicks) * 100 : 0;
  const crDelta = pctDelta(curCR, prevCR);

  if (crDelta <= -25) {
    alerts.push({
      id: "acct-cr-drop",
      category: "account",
      severity: "danger",
      title: `Taxa de conversão caiu ${fmtPct(crDelta)}`,
      description: `Taxa atual: ${curCR.toFixed(1)}% vs anterior: ${prevCR.toFixed(1)}%.`,
      metric: "conversion_rate",
      currentValue: Math.round(curCR * 100) / 100,
      previousValue: Math.round(prevCR * 100) / 100,
      deltaPct: Math.round(crDelta),
      recommendation: "Verifique se houve mudanças no site, preços ou disponibilidade",
    });
  } else if (crDelta <= -15) {
    alerts.push({
      id: "acct-cr-warn",
      category: "account",
      severity: "warn",
      title: `Taxa de conversão em queda: ${fmtPct(crDelta)}`,
      description: `Taxa atual: ${curCR.toFixed(1)}% vs anterior: ${prevCR.toFixed(1)}%.`,
      metric: "conversion_rate",
      currentValue: Math.round(curCR * 100) / 100,
      previousValue: Math.round(prevCR * 100) / 100,
      deltaPct: Math.round(crDelta),
    });
  }

  // Receita
  const revDelta = pctDelta(current.revenue, previous.revenue);
  if (revDelta <= -25) {
    alerts.push({
      id: "acct-rev-drop",
      category: "account",
      severity: "danger",
      title: `Receita total caiu ${fmtPct(revDelta)} vs período anterior`,
      description: `Receita atual: ${fmtBRL(current.revenue)} vs anterior: ${fmtBRL(previous.revenue)}.`,
      metric: "revenue",
      currentValue: Math.round(current.revenue * 100) / 100,
      previousValue: Math.round(previous.revenue * 100) / 100,
      deltaPct: Math.round(revDelta),
      recommendation: "Analise os SKUs com maior queda de receita e reforce investimento nos que mantiveram desempenho",
    });
  } else if (revDelta <= -10) {
    alerts.push({
      id: "acct-rev-warn",
      category: "account",
      severity: "warn",
      title: `Receita total em queda moderada: ${fmtPct(revDelta)}`,
      description: `Receita atual: ${fmtBRL(current.revenue)} vs anterior: ${fmtBRL(previous.revenue)}.`,
      metric: "revenue",
      currentValue: Math.round(current.revenue * 100) / 100,
      previousValue: Math.round(previous.revenue * 100) / 100,
      deltaPct: Math.round(revDelta),
    });
  }

  return alerts;
}

/* =========================
   Alertas de Campanha
========================= */

function computeCampaignAlerts(
  currentCampaigns: CampaignMetrics[],
  previousCampaigns: CampaignMetrics[],
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const prevMap = new Map(previousCampaigns.map((c) => [c.campaignId, c]));

  for (const camp of currentCampaigns) {
    const prev = prevMap.get(camp.campaignId);

    // Zero conversões com gasto significativo (não precisa de prev)
    if (camp.conversions === 0 && camp.costBRL > 50) {
      alerts.push({
        id: `camp-${camp.campaignId}-zero-conv`,
        category: "campaign",
        severity: "danger",
        title: `Campanha '${camp.campaignName}': gastou ${fmtBRL(camp.costBRL)} sem conversões`,
        description: `${camp.impressions.toLocaleString("pt-BR")} impressões e ${camp.clicks.toLocaleString("pt-BR")} cliques, mas nenhuma conversão.`,
        metric: "conversions",
        currentValue: 0,
        previousValue: prev?.conversions ?? 0,
        deltaPct: -100,
        entityName: camp.campaignName,
        entityId: camp.campaignId,
        recommendation: "Pause esta campanha imediatamente e reavalie a estratégia",
      });
      continue;
    }

    if (!prev || camp.costBRL < 10) continue;

    // ROAS
    const curRoas = camp.costBRL > 0 ? camp.revenue / camp.costBRL : 0;
    const prevRoas = prev.costBRL > 0 ? prev.revenue / prev.costBRL : 0;
    const roasDelta = pctDelta(curRoas, prevRoas);

    if (roasDelta <= -30) {
      alerts.push({
        id: `camp-${camp.campaignId}-roas-drop`,
        category: "campaign",
        severity: "danger",
        title: `Campanha '${camp.campaignName}': ROAS despencou ${fmtPct(roasDelta)}`,
        description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: camp.campaignName,
        entityId: camp.campaignId,
        recommendation: "Considere pausar esta campanha ou revisar os termos de busca",
      });
    } else if (roasDelta <= -15) {
      alerts.push({
        id: `camp-${camp.campaignId}-roas-warn`,
        category: "campaign",
        severity: "warn",
        title: `Campanha '${camp.campaignName}': ROAS caiu ${fmtPct(roasDelta)}`,
        description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: camp.campaignName,
        entityId: camp.campaignId,
      });
    }

    // CPA
    const curCPA = camp.conversions > 0 ? camp.costBRL / camp.conversions : 0;
    const prevCPA = prev.conversions > 0 ? prev.costBRL / prev.conversions : 0;
    const cpaDelta = pctDelta(curCPA, prevCPA);

    if (cpaDelta >= 30 && curCPA > 0) {
      alerts.push({
        id: `camp-${camp.campaignId}-cpa-spike`,
        category: "campaign",
        severity: "danger",
        title: `Campanha '${camp.campaignName}': CPA subiu ${fmtPct(cpaDelta)}`,
        description: `CPA atual: ${fmtBRL(curCPA)} vs anterior: ${fmtBRL(prevCPA)}.`,
        metric: "CPA",
        currentValue: Math.round(curCPA * 100) / 100,
        previousValue: Math.round(prevCPA * 100) / 100,
        deltaPct: Math.round(cpaDelta),
        entityName: camp.campaignName,
        entityId: camp.campaignId,
        recommendation: "Avalie negativar termos de busca ou ajustar público-alvo",
      });
    } else if (cpaDelta >= 15 && curCPA > 0) {
      alerts.push({
        id: `camp-${camp.campaignId}-cpa-warn`,
        category: "campaign",
        severity: "warn",
        title: `Campanha '${camp.campaignName}': CPA em alta de ${fmtPct(cpaDelta)}`,
        description: `CPA atual: ${fmtBRL(curCPA)} vs anterior: ${fmtBRL(prevCPA)}.`,
        metric: "CPA",
        currentValue: Math.round(curCPA * 100) / 100,
        previousValue: Math.round(prevCPA * 100) / 100,
        deltaPct: Math.round(cpaDelta),
        entityName: camp.campaignName,
        entityId: camp.campaignId,
      });
    }

    // ROAS muito baixo em Shopping/PMax
    if (
      (camp.channelType === "PERFORMANCE_MAX" || camp.channelType === "SHOPPING") &&
      curRoas > 0 && curRoas < 3 && camp.costBRL > 20
    ) {
      alerts.push({
        id: `camp-${camp.campaignId}-low-roas`,
        category: "campaign",
        severity: "warn",
        title: `Campanha '${camp.campaignName}' (${camp.channelType === "PERFORMANCE_MAX" ? "PMax" : "Shopping"}): ROAS de apenas ${curRoas.toFixed(1)}`,
        description: `Gasto: ${fmtBRL(camp.costBRL)}, receita: ${fmtBRL(camp.revenue)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: camp.campaignName,
        entityId: camp.campaignId,
        recommendation: "Canal com ROAS muito baixo. Considere redistribuir orçamento",
      });
    }
  }

  // Limitar a 5
  return alerts.slice(0, 5);
}

/* =========================
   Alertas de SKU
========================= */

function computeSkuAlerts(
  currentSkus: SkuMetrics[],
  previousSkus: SkuMetrics[],
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const prevMap = new Map(previousSkus.map((s) => [s.sku, s]));

  // Top 20 por gasto
  const top = [...currentSkus].sort((a, b) => b.costBRL - a.costBRL).slice(0, 20);

  for (const sku of top) {
    const prev = prevMap.get(sku.sku);

    // Zero conversões com gasto
    if (sku.conversions === 0 && sku.costBRL > 30) {
      alerts.push({
        id: `sku-${sku.sku}-zero-conv`,
        category: "sku",
        severity: "danger",
        title: `SKU ${sku.sku}: gastou ${fmtBRL(sku.costBRL)} sem nenhuma venda`,
        description: `${sku.clicks} cliques mas nenhuma conversão no período.`,
        metric: "conversions",
        currentValue: 0,
        previousValue: prev?.conversions ?? 0,
        deltaPct: -100,
        entityName: sku.title || sku.sku,
        entityId: sku.sku,
        recommendation: "Pause anúncios deste SKU ou revise a página do produto",
      });
      continue;
    }

    if (!prev || sku.costBRL < 10) continue;

    const curRoas = sku.costBRL > 0 ? sku.revenue / sku.costBRL : 0;
    const prevRoas = prev.costBRL > 0 ? prev.revenue / prev.costBRL : 0;
    const roasDelta = pctDelta(curRoas, prevRoas);

    // ROAS subiu muito (positivo)
    if (roasDelta >= 30 && curRoas >= 7) {
      alerts.push({
        id: `sku-${sku.sku}-roas-up`,
        category: "sku",
        severity: "success",
        title: `SKU ${sku.sku}: ROAS subiu ${fmtPct(roasDelta)} — desempenho excelente`,
        description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: sku.title || sku.sku,
        entityId: sku.sku,
        recommendation: "Considere aumentar o orçamento para este SKU",
      });
      continue;
    }

    // ROAS caiu
    if (roasDelta <= -20) {
      alerts.push({
        id: `sku-${sku.sku}-roas-drop`,
        category: "sku",
        severity: "danger",
        title: `SKU ${sku.sku}: ROAS caiu ${fmtPct(roasDelta)}`,
        description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: sku.title || sku.sku,
        entityId: sku.sku,
        recommendation: "Considere pausar anúncios deste SKU até estabilizar",
      });
    } else if (roasDelta <= -10) {
      alerts.push({
        id: `sku-${sku.sku}-roas-warn`,
        category: "sku",
        severity: "warn",
        title: `SKU ${sku.sku}: ROAS em queda de ${fmtPct(roasDelta)}`,
        description: `ROAS atual: ${curRoas.toFixed(1)} vs anterior: ${prevRoas.toFixed(1)}.`,
        metric: "ROAS",
        currentValue: Math.round(curRoas * 100) / 100,
        previousValue: Math.round(prevRoas * 100) / 100,
        deltaPct: Math.round(roasDelta),
        entityName: sku.title || sku.sku,
        entityId: sku.sku,
      });
    }

    // Receita caiu
    const revDelta = pctDelta(sku.revenue, prev.revenue);
    if (revDelta <= -25 && prev.revenue > 100) {
      alerts.push({
        id: `sku-${sku.sku}-rev-drop`,
        category: "sku",
        severity: "warn",
        title: `SKU ${sku.sku}: receita caiu ${fmtPct(revDelta)}`,
        description: `Receita atual: ${fmtBRL(sku.revenue)} vs anterior: ${fmtBRL(prev.revenue)}.`,
        metric: "revenue",
        currentValue: Math.round(sku.revenue * 100) / 100,
        previousValue: Math.round(prev.revenue * 100) / 100,
        deltaPct: Math.round(revDelta),
        entityName: sku.title || sku.sku,
        entityId: sku.sku,
        recommendation: "Verifique preço, disponibilidade e concorrência deste produto",
      });
    }
  }

  return alerts.slice(0, 5);
}

/* =========================
   Alertas de Tendência
========================= */

function computeTrendAlerts(dailyData: DailyMetrics[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (dailyData.length < 3) return alerts;

  // ROAS declinando
  let roasDecline = 0;
  for (let i = 1; i < dailyData.length; i++) {
    const curR = dailyData[i].costBRL > 0 ? dailyData[i].revenue / dailyData[i].costBRL : null;
    const prevR = dailyData[i - 1].costBRL > 0 ? dailyData[i - 1].revenue / dailyData[i - 1].costBRL : null;
    if (curR !== null && prevR !== null && curR < prevR) {
      roasDecline++;
    } else {
      roasDecline = 0;
    }
    if (roasDecline >= 3) {
      alerts.push({
        id: "trend-roas-decline",
        category: "trend",
        severity: "warn",
        title: `ROAS em queda há ${roasDecline + 1} dias consecutivos`,
        description: `Tendência negativa detectada nos últimos dias da série.`,
        metric: "ROAS",
        currentValue: curR ?? 0,
        previousValue: prevR ?? 0,
        deltaPct: 0,
        recommendation: "Revise campanhas e SKUs antes que a situação piore",
      });
      break;
    }
  }

  // CPA subindo
  let cpaRise = 0;
  for (let i = 1; i < dailyData.length; i++) {
    const curC = dailyData[i].conversions > 0 ? dailyData[i].costBRL / dailyData[i].conversions : null;
    const prevC = dailyData[i - 1].conversions > 0 ? dailyData[i - 1].costBRL / dailyData[i - 1].conversions : null;
    if (curC !== null && prevC !== null && curC > prevC) {
      cpaRise++;
    } else {
      cpaRise = 0;
    }
    if (cpaRise >= 3) {
      alerts.push({
        id: "trend-cpa-rise",
        category: "trend",
        severity: "warn",
        title: `CPA subindo há ${cpaRise + 1} dias consecutivos`,
        description: `Custo por aquisição em tendência de alta.`,
        metric: "CPA",
        currentValue: curC ?? 0,
        previousValue: prevC ?? 0,
        deltaPct: 0,
        recommendation: "Avalie ajustar lances e segmentação",
      });
      break;
    }
  }

  // Receita declinando
  let revDecline = 0;
  for (let i = 1; i < dailyData.length; i++) {
    if (dailyData[i].revenue < dailyData[i - 1].revenue) {
      revDecline++;
    } else {
      revDecline = 0;
    }
    if (revDecline >= 4) {
      alerts.push({
        id: "trend-rev-decline",
        category: "trend",
        severity: "danger",
        title: `Receita em queda há ${revDecline + 1} dias consecutivos`,
        description: `Receita em tendência negativa prolongada.`,
        metric: "revenue",
        currentValue: dailyData[i].revenue,
        previousValue: dailyData[i - 1].revenue,
        deltaPct: 0,
        recommendation: "Ação urgente necessária — receita em queda prolongada",
      });
      break;
    }
  }

  return alerts;
}

/* =========================
   Alertas de Retenção
========================= */

function computeRetentionAlerts(summary: RetentionSummary): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // Taxa de retorno
  if (summary.returnRate < 15) {
    alerts.push({
      id: "ret-return-rate-danger",
      category: "retention",
      severity: "danger",
      title: "Taxa de retorno muito baixa",
      description: `Apenas ${summary.returnRate.toFixed(1)}% dos usuários retornam ao site.`,
      metric: "return_rate",
      currentValue: summary.returnRate,
      previousValue: 0,
      deltaPct: 0,
      recommendation: "Invista em remarketing, e-mail marketing e programas de fidelidade",
    });
  } else if (summary.returnRate < 25) {
    alerts.push({
      id: "ret-return-rate-warn",
      category: "retention",
      severity: "warn",
      title: "Taxa de retorno abaixo do ideal",
      description: `Taxa de retorno de ${summary.returnRate.toFixed(1)}% — ideal é acima de 25%.`,
      metric: "return_rate",
      currentValue: summary.returnRate,
      previousValue: 0,
      deltaPct: 0,
      recommendation: "Considere campanhas de reativação para usuários inativos",
    });
  } else if (summary.returnRate >= 35) {
    alerts.push({
      id: "ret-return-rate-healthy",
      category: "retention",
      severity: "success",
      title: "Taxa de retorno saudável",
      description: `${summary.returnRate.toFixed(1)}% dos usuários retornam — excelente retenção.`,
      metric: "return_rate",
      currentValue: summary.returnRate,
      previousValue: 0,
      deltaPct: 0,
    });
  }

  // Frequência de recompra
  if (summary.repurchaseEstimate < 1) {
    alerts.push({
      id: "ret-repurchase-low",
      category: "retention",
      severity: "warn",
      title: "Baixa frequência de recompra",
      description: `Frequência estimada de ${summary.repurchaseEstimate.toFixed(2)} compras por cliente retornante.`,
      metric: "repurchase_frequency",
      currentValue: summary.repurchaseEstimate,
      previousValue: 0,
      deltaPct: 0,
      recommendation: "Implemente cross-sell, bundles e automações pós-compra",
    });
  }

  // LTV médio por comprador
  const ltvPerPurchaser = summary.purchasers > 0 ? summary.revenue / summary.purchasers : 0;
  if (ltvPerPurchaser > 0 && ltvPerPurchaser < 150) {
    alerts.push({
      id: "ret-ltv-low",
      category: "retention",
      severity: "warn",
      title: "LTV médio por comprador baixo",
      description: `LTV médio de ${fmtBRL(ltvPerPurchaser)} por comprador — considere estratégias de upsell.`,
      metric: "ltv",
      currentValue: Math.round(ltvPerPurchaser * 100) / 100,
      previousValue: 0,
      deltaPct: 0,
      recommendation: "Foque em aumentar ticket médio e frequência de compra",
    });
  }

  return alerts;
}

/* =========================
   Orquestrador
========================= */

const SEVERITY_ORDER: Record<string, number> = { danger: 0, warn: 1, info: 2, success: 3 };

export function computeAllSmartAlerts(
  currentAccount: AccountTotals,
  previousAccount: AccountTotals,
  currentCampaigns: CampaignMetrics[],
  previousCampaigns: CampaignMetrics[],
  currentSkus: SkuMetrics[],
  previousSkus: SkuMetrics[],
  dailyTimeSeries: DailyMetrics[],
  retentionSummary?: RetentionSummary,
): SmartAlert[] {
  const all = [
    ...computeAccountAlerts(currentAccount, previousAccount),
    ...computeCampaignAlerts(currentCampaigns, previousCampaigns),
    ...computeSkuAlerts(currentSkus, previousSkus),
    ...computeTrendAlerts(dailyTimeSeries),
    ...(retentionSummary ? computeRetentionAlerts(retentionSummary) : []),
  ];

  all.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));

  return all.slice(0, 15);
}
