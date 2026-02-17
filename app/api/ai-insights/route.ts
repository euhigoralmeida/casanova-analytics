import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { AI_CONFIG } from "@/lib/ai/config";
import { createGeminiClient, withRetry } from "@/lib/ai/client";
import { buildContextSummary, buildPeriodContext } from "@/lib/ai/context-builder";
import { insightsSystemPrompt, insightsUserPrompt } from "@/lib/ai/prompts";
import { cacheGet, cacheSet, insightsCacheKey } from "@/lib/ai/cache";
import { checkInsightsLimit } from "@/lib/ai/rate-limiter";
import { fetchCognitiveDirectly } from "@/lib/ai/fetch-cognitive";

type InsightsResponse = {
  analysis: string;
  highlights: string[];
  generatedAt: string;
  cached: boolean;
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "IA não disponível" }, { status: 503 });
  }

  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  if (!AI_CONFIG.enabled) {
    return NextResponse.json({ error: "IA desabilitada" }, { status: 503 });
  }

  const { startDate, endDate } = await req.json();
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate e endDate obrigatórios" }, { status: 400 });
  }

  // Check cache
  const cacheKey = insightsCacheKey(session.tenantId, startDate, endDate);
  const cached = cacheGet<InsightsResponse>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  // Rate limit
  if (!checkInsightsLimit(session.tenantId, AI_CONFIG.rateLimit.insightsPerHour)) {
    return NextResponse.json({ error: "Limite de requisições atingido." }, { status: 429 });
  }

  try {
    const cognitiveData = await fetchCognitiveDirectly(session.tenantId, startDate, endDate);
    if (!cognitiveData) {
      return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
    }

    const contextSummary = buildContextSummary(cognitiveData);
    const periodContext = buildPeriodContext(startDate, endDate);

    // Create Gemini model (no tools for insights)
    const genAI = createGeminiClient(apiKey);
    const model = genAI.getGenerativeModel({
      model: AI_CONFIG.insights.model,
      systemInstruction: insightsSystemPrompt(),
      generationConfig: {
        maxOutputTokens: AI_CONFIG.insights.maxTokens,
        temperature: AI_CONFIG.insights.temperature,
      },
    });

    const result = await withRetry(() =>
      model.generateContent(insightsUserPrompt(contextSummary, periodContext)),
    );
    const rawText = result.response.text();

    // Parse JSON from response
    let analysis = "";
    let highlights: string[] = [];

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = parsed.analysis ?? "";
        highlights = parsed.highlights ?? [];
      } else {
        analysis = rawText;
      }
    } catch {
      analysis = rawText;
    }

    const responseData: InsightsResponse = {
      analysis,
      highlights,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    cacheSet(cacheKey, responseData, AI_CONFIG.cache.insightsTtlMs);
    return NextResponse.json(responseData);
  } catch (err) {
    console.error("AI Insights error:", err);
    return NextResponse.json({ error: "Erro ao gerar insights IA" }, { status: 500 });
  }
}
