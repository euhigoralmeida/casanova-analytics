import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import {
  discoverIGAccountId,
  fetchIGAccount,
  fetchIGMedia,
  fetchIGMediaInsights,
  fetchIGDailyInsights,
  fetchIGPeriodTotals,
  fetchIGAudienceDemographics,
  fetchIGOnlineFollowers,
} from "@/lib/instagram";
import type { IGInsightsResponse } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;
  const tenantId = getEffectiveTenantId(auth.session);

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    // Discover IG Business Account
    const igUserId = await discoverIGAccountId(tenantId);
    if (!igUserId) {
      return NextResponse.json({
        source: "discovery_failed",
        updatedAt: new Date().toISOString(),
      } satisfies IGInsightsResponse);
    }

    // Fetch all data in parallel
    const [account, media, dailyInsights, periodTotals, audience, onlineFollowers] = await Promise.all([
      fetchIGAccount(igUserId, tenantId),
      fetchIGMedia(igUserId, 50, tenantId),
      fetchIGDailyInsights(igUserId, startDate, endDate, tenantId).catch(() => []),
      fetchIGPeriodTotals(igUserId, startDate, endDate, tenantId).catch(() => ({
        views: 0, totalInteractions: 0, accountsEngaged: 0, followsAndUnfollows: 0,
      })),
      fetchIGAudienceDemographics(igUserId, tenantId).catch(() => ({ genderAge: [], countries: [], cities: [] })),
      fetchIGOnlineFollowers(igUserId, tenantId).catch(() => []),
    ]);

    // Enrich top 25 posts by engagement with individual insights
    const sortedMedia = [...media]
      .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
      .slice(0, 25);

    const mediaInsights = await Promise.all(
      sortedMedia.map((m) =>
        fetchIGMediaInsights(m.id, tenantId).catch(() => ({
          mediaId: m.id,
          reach: 0,
          saved: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          totalInteractions: 0,
        })),
      ),
    );

    return NextResponse.json({
      source: "instagram",
      updatedAt: new Date().toISOString(),
      account,
      media: sortedMedia,
      mediaInsights,
      dailyInsights,
      periodTotals,
      audienceGenderAge: audience.genderAge,
      audienceCountries: audience.countries,
      audienceCities: audience.cities,
      onlineFollowers,
    } satisfies IGInsightsResponse);
  } catch (err) {
    console.error("Instagram API error:", err);
    return NextResponse.json({
      source: "not_configured",
      updatedAt: new Date().toISOString(),
    } satisfies IGInsightsResponse);
  }
}
