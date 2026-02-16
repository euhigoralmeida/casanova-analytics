// Anthropic SDK client factory
// API key must be passed explicitly because process.env is not
// reliably available in imported modules on Vercel serverless.

import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}
