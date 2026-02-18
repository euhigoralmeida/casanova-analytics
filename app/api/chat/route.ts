import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { AI_CONFIG } from "@/lib/ai/config";
import { createGeminiClient, withRetry } from "@/lib/ai/client";
import { GEMINI_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/tool-executor";
import { buildContextSummary, buildPeriodContext } from "@/lib/ai/context-builder";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { checkChatLimit } from "@/lib/ai/rate-limiter";
import { fetchCognitiveDirectly } from "@/lib/ai/fetch-cognitive";
import type { Content, Part } from "@google/generative-ai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada no servidor" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  if (!AI_CONFIG.enabled) {
    return new Response(JSON.stringify({ error: "IA desabilitada" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!checkChatLimit(session.tenantId, AI_CONFIG.rateLimit.chatPerHour)) {
    return new Response(JSON.stringify({ error: "Limite de mensagens atingido. Tente novamente em alguns minutos." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { messages, context } = body as {
    messages: ChatMessage[];
    context: { startDate: string; endDate: string };
  };

  if (!messages?.length || !context?.startDate || !context?.endDate) {
    return new Response(JSON.stringify({ error: "Dados inválidos" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch cognitive context
    let contextSummary = "Dados de análise não disponíveis no momento.";
    try {
      const cognitiveData = await fetchCognitiveDirectly(session.tenantId, context.startDate, context.endDate);
      if (cognitiveData) {
        contextSummary = buildContextSummary(cognitiveData);
      }
    } catch (ctxErr) {
      console.error("Chat: cognitive context error (non-fatal):", ctxErr);
    }

    const periodContext = buildPeriodContext(context.startDate, context.endDate);
    const systemPrompt = chatSystemPrompt(contextSummary, periodContext);

    // Create Gemini model with tools
    const genAI = createGeminiClient(apiKey);
    const model = genAI.getGenerativeModel({
      model: AI_CONFIG.chat.model,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: GEMINI_TOOLS }],
      generationConfig: {
        maxOutputTokens: AI_CONFIG.chat.maxTokens,
        temperature: AI_CONFIG.chat.temperature,
      },
    });

    // Convert messages to Gemini format
    const geminiHistory: Content[] = [];
    for (const msg of messages.slice(0, -1)) {
      geminiHistory.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Start chat with history
    const chat = model.startChat({ history: geminiHistory });

    // Send the last user message (with retry for 429 rate limits)
    const lastMessage = messages[messages.length - 1].content;
    let result = await withRetry(() => chat.sendMessage(lastMessage));
    let response = result.response;

    // Agentic loop: handle function calls
    const maxToolRounds = 3;
    for (let round = 0; round < maxToolRounds; round++) {
      const functionCalls = response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) break;

      // Execute all function calls
      const functionResponses: Part[] = [];
      for (const fc of functionCalls) {
        const toolResult = await executeTool(
          fc.name,
          fc.args as Record<string, unknown>,
          session.tenantId,
        );
        // Gemini requires response to be an object (Struct), not an array
        const parsed = JSON.parse(toolResult);
        const responseObj = Array.isArray(parsed) ? { data: parsed } : parsed;
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: responseObj,
          },
        });
      }

      // Send function results back to the model (with retry for 429)
      result = await withRetry(() => chat.sendMessage(functionResponses));
      response = result.response;
    }

    // Extract final text
    const finalText = response.text();

    return new Response(JSON.stringify({ response: finalText }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes("429") || msg.includes("Resource exhausted");
    return new Response(
      JSON.stringify({
        error: isRateLimit
          ? "Limite de requisições da IA atingido. Aguarde ~15 segundos e tente novamente."
          : "Erro ao processar pergunta",
        detail: isRateLimit ? undefined : msg,
      }),
      {
        status: isRateLimit ? 429 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
