import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { AI_CONFIG } from "@/lib/ai/config";
import { createLLMProvider } from "@/lib/ai/llm-provider";
import { buildStrategicBrief } from "@/lib/ai/strategic-brief";
import { strategicAdvisorSystemPrompt, strategicAdvisorUserPrompt } from "@/lib/ai/prompts";
import { cacheGet, cacheSet } from "@/lib/ai/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

type StrategicAdvisorResponse = {
  diagnosis: {
    headline: string;
    body: string;
    primaryBottleneck: "aquisicao" | "cro" | "retencao";
  };
  decisions: {
    priority: number;
    domain: "aquisicao" | "retencao" | "cro" | "cross";
    action: string;
    reasoning: string;
    estimatedImpact: string;
    effort: "baixo" | "medio" | "alto";
    urgency: "imediata" | "esta_semana" | "este_mes";
    metricsToWatch: string[];
  }[];
  crossDomainInsights: {
    insight: string;
    domains: string[];
    implication: string;
  }[];
  avoidActions: {
    action: string;
    reason: string;
  }[];
  strategicQuestion: string;
  generatedAt: string;
  cached: boolean;
};

// Rate limit: 10/hour per tenant
const rateLimits = new Map<string, number[]>();

function checkAdvisorLimit(tenantId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 3600_000;
  let timestamps = rateLimits.get(tenantId) ?? [];
  timestamps = timestamps.filter((t) => t > oneHourAgo);
  if (timestamps.length >= 10) return false;
  timestamps.push(now);
  rateLimits.set(tenantId, timestamps);
  return true;
}

function advisorCacheKey(tenantId: string, startDate: string, endDate: string): string {
  return `strategic-advisor:${tenantId}:${startDate}:${endDate}`;
}

export async function GET(req: NextRequest) {
  if (!AI_CONFIG.enabled) {
    return new Response(JSON.stringify({ error: "IA desabilitada" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const provider = AI_CONFIG.provider;
  if (provider === "gemini" && !apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return new Response(JSON.stringify({ error: "startDate e endDate são obrigatórios" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check cache
  const cacheKey = advisorCacheKey(session.tenantId, startDate, endDate);
  const cached = cacheGet<StrategicAdvisorResponse>(cacheKey);
  if (cached) {
    return Response.json({ ...cached, cached: true });
  }

  // Rate limit
  if (!checkAdvisorLimit(session.tenantId)) {
    return new Response(JSON.stringify({ error: "Limite de consultas estratégicas atingido. Tente novamente em alguns minutos." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Build the cross-domain brief
    const brief = await buildStrategicBrief(session.tenantId, startDate, endDate);

    // Generate strategic analysis via LLM
    const llm = createLLMProvider();
    const systemPrompt = strategicAdvisorSystemPrompt();
    const userPrompt = strategicAdvisorUserPrompt(brief);

    const result = await llm.generateJSON<Omit<StrategicAdvisorResponse, "generatedAt" | "cached">>({
      systemPrompt,
      userPrompt,
      temperature: AI_CONFIG.strategic.temperature,
      maxTokens: AI_CONFIG.strategic.maxTokens,
    });

    const response: StrategicAdvisorResponse = {
      ...result,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    // Cache for 10 min
    cacheSet(cacheKey, response, AI_CONFIG.cache.advisorTtlMs);

    return Response.json(response);
  } catch (err) {
    console.error("Strategic Advisor error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes("429") || msg.includes("Resource exhausted");
    return new Response(
      JSON.stringify({
        error: isRateLimit
          ? "Limite de requisições da IA atingido. Aguarde e tente novamente."
          : "Erro ao gerar análise estratégica",
        detail: isRateLimit ? undefined : msg,
      }),
      {
        status: isRateLimit ? 429 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
