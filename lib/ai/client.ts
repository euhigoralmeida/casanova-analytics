// Anthropic SDK client — reads API key explicitly from process.env each time
// Avoids singleton caching issues on Vercel serverless

import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      `ANTHROPIC_API_KEY not found. Keys available: ${Object.keys(process.env).filter(k => k.includes("ANTHROPIC")).join(", ") || "none with ANTHROPIC"}`
    );
  }
  return new Anthropic({ apiKey });
}
