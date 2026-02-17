import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_CONFIG } from "@/lib/ai/config";
import { createGeminiClient } from "@/lib/ai/client";
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

  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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

    // Send the last user message
    const lastMessage = messages[messages.length - 1].content;
    let result = await chat.sendMessage(lastMessage);
    let response = result.response;

    // Agentic loop: handle function calls
    const maxToolRounds = 5;
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
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: JSON.parse(toolResult),
          },
        });
      }

      // Send function results back to the model
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    // Extract final text
    const finalText = response.text();

    return new Response(JSON.stringify({ response: finalText }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Erro ao processar pergunta", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
