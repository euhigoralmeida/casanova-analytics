// Pluggable LLM provider abstraction
// Reads LLM_PROVIDER env var to select Gemini (default) or Claude

import { AI_CONFIG } from "./config";
import { withRetry } from "./client";

type GenerateOpts = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export interface LLMProvider {
  generateJSON<T>(opts: GenerateOpts): Promise<T>;
  generateText(opts: GenerateOpts): Promise<string>;
}

function createGeminiProvider(): LLMProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleGenerativeAI } = require("@google/generative-ai") as typeof import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    async generateJSON<T>(opts: GenerateOpts): Promise<T> {
      const model = genAI.getGenerativeModel({
        model: AI_CONFIG.strategic.model,
        systemInstruction: opts.systemPrompt,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? AI_CONFIG.strategic.maxTokens,
          temperature: opts.temperature ?? AI_CONFIG.strategic.temperature,
          responseMimeType: "application/json",
        },
      });
      const result = await withRetry(() => model.generateContent(opts.userPrompt));
      const text = result.response.text();
      return JSON.parse(text) as T;
    },

    async generateText(opts: GenerateOpts): Promise<string> {
      const model = genAI.getGenerativeModel({
        model: AI_CONFIG.strategic.model,
        systemInstruction: opts.systemPrompt,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? AI_CONFIG.strategic.maxTokens,
          temperature: opts.temperature ?? AI_CONFIG.strategic.temperature,
        },
      });
      const result = await withRetry(() => model.generateContent(opts.userPrompt));
      return result.response.text();
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAnthropicSDK(): any {
  // Dynamic module name to prevent webpack/Next.js from resolving at build time
  const moduleName = ["@anthropic-ai", "sdk"].join("/");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(moduleName).default;
}

function createClaudeProvider(): LLMProvider {
  // Requires: npm install @anthropic-ai/sdk
  return {
    async generateJSON<T>(opts: GenerateOpts): Promise<T> {
      const Anthropic = loadAnthropicSDK();
      const client = new Anthropic();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await withRetry(() =>
        client.messages.create({
          model: AI_CONFIG.strategic.model,
          max_tokens: opts.maxTokens ?? AI_CONFIG.strategic.maxTokens,
          temperature: opts.temperature ?? AI_CONFIG.strategic.temperature,
          system: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
        }),
      );
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      return JSON.parse(text) as T;
    },

    async generateText(opts: GenerateOpts): Promise<string> {
      const Anthropic = loadAnthropicSDK();
      const client = new Anthropic();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await withRetry(() =>
        client.messages.create({
          model: AI_CONFIG.strategic.model,
          max_tokens: opts.maxTokens ?? AI_CONFIG.strategic.maxTokens,
          temperature: opts.temperature ?? AI_CONFIG.strategic.temperature,
          system: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
        }),
      );
      return result.content[0].type === "text" ? result.content[0].text : "";
    },
  };
}

export function createLLMProvider(): LLMProvider {
  const provider = AI_CONFIG.provider;
  if (provider === "claude") return createClaudeProvider();
  return createGeminiProvider();
}
