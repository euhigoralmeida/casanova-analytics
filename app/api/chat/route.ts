import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_CONFIG } from "@/lib/ai/config";
import { getAnthropicClient } from "@/lib/ai/client";
import { AI_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/tool-executor";
import { buildContextSummary, buildPeriodContext } from "@/lib/ai/context-builder";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { checkChatLimit } from "@/lib/ai/rate-limiter";
import type Anthropic from "@anthropic-ai/sdk";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
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
    // Fetch cognitive context for the system prompt
    const baseUrl = req.nextUrl.origin;
    const intelligenceRes = await fetch(
      `${baseUrl}/api/intelligence?period=custom&startDate=${context.startDate}&endDate=${context.endDate}`,
      { headers: { cookie: req.headers.get("cookie") ?? "" } },
    );

    let contextSummary = "Dados de análise não disponíveis no momento.";
    if (intelligenceRes.ok) {
      const cognitiveData = await intelligenceRes.json();
      contextSummary = buildContextSummary(cognitiveData);
    }

    const periodContext = buildPeriodContext(context.startDate, context.endDate);
    const systemPrompt = chatSystemPrompt(contextSummary, periodContext);

    const client = getAnthropicClient();

    // Build messages for Claude API
    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Agentic loop: handle tool use
    let currentMessages = apiMessages;
    const maxToolRounds = 5;
    let finalText = "";

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await client.messages.create({
        model: AI_CONFIG.chat.model,
        max_tokens: AI_CONFIG.chat.maxTokens,
        temperature: AI_CONFIG.chat.temperature,
        system: systemPrompt,
        messages: currentMessages,
        tools: AI_TOOLS,
      });

      // Collect text blocks
      let roundText = "";
      const toolUseBlocks: Anthropic.ContentBlock[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          roundText += block.text;
        } else if (block.type === "tool_use") {
          toolUseBlocks.push(block);
        }
      }

      finalText += roundText;

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Execute tool calls
      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") return { type: "text" as const, text: "" };
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              session.tenantId,
            );
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          }),
        ),
      };

      // Continue conversation with tool results
      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        toolResults,
      ];
    }

    // Return the final text response
    return new Response(JSON.stringify({ response: finalText }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Erro ao processar pergunta" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
