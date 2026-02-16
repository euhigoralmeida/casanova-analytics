/**
 * Meta Ads Integration — Stub (V1)
 *
 * Preparado para integração futura com a API de Marketing do Meta (Facebook/Instagram).
 * Em V1, retorna dados mock ou "not_configured".
 */

export function isMetaAdsConfigured(): boolean {
  return !!(
    process.env.META_ADS_ACCESS_TOKEN &&
    process.env.META_ADS_ACCOUNT_ID
  );
}

export type MetaAdsCampaign = {
  campaignId: string;
  campaignName: string;
  platform: "facebook" | "instagram";
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
};

export type MetaAdsResponse = {
  source: "meta-ads" | "not_configured";
  campaigns: MetaAdsCampaign[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchMetaAdsCampaigns(_startDate: string, _endDate: string): Promise<MetaAdsResponse> {
  if (!isMetaAdsConfigured()) {
    return { source: "not_configured", campaigns: [] };
  }

  // TODO: Implementar integração real com Meta Marketing API
  // const url = `https://graph.facebook.com/v19.0/act_${accountId}/campaigns`;
  return { source: "not_configured", campaigns: [] };
}
