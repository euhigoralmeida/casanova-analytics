import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_CONFIG } from "@/lib/ai/config";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildContextSummary, buildPeriodContext } from "@/lib/ai/context-builder";
import { insightsSystemPrompt, insightsUserPrompt } from "@/lib/ai/prompts";
import { cacheGet, cacheSet, insightsCacheKey } from "@/lib/ai/cache";
import { checkInsightsLimit } from "@/lib/ai/rate-limiter";

type InsightsResponse = {
  analysis: string;
  highlights: string[];
  generatedAt: string;
  cached: boolean;
};

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }, { status: 429 });
  }

  try {
    // Fetch cognitive analysis for context
    const baseUrl = req.nextUrl.origin;
    const intelligenceRes = await fetch(
      `${baseUrl}/api/intelligence?period=custom&startDate=${startDate}&endDate=${endDate}`,
      { headers: { cookie: req.headers.get("cookie") ?? "" } },
    );

    if (!intelligenceRes.ok) {
      return NextResponse.json({ error: "Erro ao buscar dados de análise" }, { status: 500 });
    }

    const cognitiveData = await intelligenceRes.json();
    const contextSummary = buildContextSummary(cognitiveData);
    const periodContext = buildPeriodContext(startDate, endDate);

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: AI_CONFIG.insights.model,
      max_tokens: AI_CONFIG.insights.maxTokens,
      temperature: AI_CONFIG.insights.temperature,
      system: insightsSystemPrompt(),
      messages: [{ role: "user", content: insightsUserPrompt(contextSummary, periodContext) }],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    // Parse JSON from response
    let analysis = "";
    let highlights: string[] = [];

    try {
      // Try to extract JSON from the response (may be wrapped in markdown code block)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = parsed.analysis ?? "";
        highlights = parsed.highlights ?? [];
      } else {
        analysis = rawText;
      }
    } catch {
      // If JSON parsing fails, use raw text as analysis
      analysis = rawText;
    }

    const result: InsightsResponse = {
      analysis,
      highlights,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    // Cache result
    cacheSet(cacheKey, result, AI_CONFIG.cache.insightsTtlMs);

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI Insights error:", err);
    return NextResponse.json({ error: "Erro ao gerar insights IA" }, { status: 500 });
  }
}
