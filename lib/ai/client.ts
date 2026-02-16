// Anthropic SDK client
// IMPORTANT: Use dot notation for process.env so Next.js can inline the value

import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(): Anthropic {
  // Dot notation is required for Next.js to inline env vars at build time
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not available at runtime");
  }
  return new Anthropic({ apiKey });
}
