import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import {
  isInstagramConfigured,
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

  if (!isInstagramConfigured()) {
    return NextResponse.json({
      source: "not_configured",
      updatedAt: new Date().toISOString(),
    } satisfies IGInsightsResponse);
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    // Discover IG Business Account
    const igUserId = await discoverIGAccountId();
    if (!igUserId) {
      return NextResponse.json({
        source: "discovery_failed",
        updatedAt: new Date().toISOString(),
      } satisfies IGInsightsResponse);
    }

    // Fetch all data in parallel
    const [account, media, dailyInsights, periodTotals, audience, onlineFollowers] = await Promise.all([
      fetchIGAccount(igUserId),
      fetchIGMedia(igUserId, 50),
      fetchIGDailyInsights(igUserId, startDate, endDate).catch(() => []),
      fetchIGPeriodTotals(igUserId, startDate, endDate).catch(() => ({
        views: 0, totalInteractions: 0, accountsEngaged: 0, followsAndUnfollows: 0,
      })),
      fetchIGAudienceDemographics(igUserId).catch(() => ({ genderAge: [], countries: [], cities: [] })),
      fetchIGOnlineFollowers(igUserId).catch(() => []),
    ]);

    // Enrich top 25 posts by engagement with individual insights
    const sortedMedia = [...media]
      .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
      .slice(0, 25);

    const mediaInsights = await Promise.all(
      sortedMedia.map((m) =>
        fetchIGMediaInsights(m.id).catch(() => ({
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
