// Google Gemini client factory + retry helper

import { GoogleGenerativeAI } from "@google/generative-ai";

export function createGeminiClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Retry wrapper for Gemini API calls that handles 429 rate limits.
 * Free tier: 15 req/min — the agentic loop can exhaust this quickly.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("Resource exhausted"));
      if (!isRateLimit || attempt === maxRetries) throw err;
      // Wait 3s, 6s before retrying
      const delay = (attempt + 1) * 3000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Retry exhausted");
}
