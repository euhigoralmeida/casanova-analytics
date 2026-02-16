import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_CONFIG } from "@/lib/ai/config";
import { createAnthropicClient } from "@/lib/ai/client";
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
  // Read API key directly in route handler
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "IA não disponível" }, { status: 503 });
  }

  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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

    // Create client with API key read in this route handler
    const client = createAnthropicClient(apiKey);
    const response = await client.messages.create({
      model: AI_CONFIG.insights.model,
      max_tokens: AI_CONFIG.insights.maxTokens,
      temperature: AI_CONFIG.insights.temperature,
      system: insightsSystemPrompt(),
      messages: [{ role: "user", content: insightsUserPrompt(contextSummary, periodContext) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

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

    const result: InsightsResponse = {
      analysis,
      highlights,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    cacheSet(cacheKey, result, AI_CONFIG.cache.insightsTtlMs);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI Insights error:", err);
    return NextResponse.json({ error: "Erro ao gerar insights IA" }, { status: 500 });
  }
}
