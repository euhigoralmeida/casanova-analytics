// Anthropic SDK client singleton
// The SDK reads ANTHROPIC_API_KEY from process.env automatically

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    // SDK auto-reads process.env.ANTHROPIC_API_KEY
    _client = new Anthropic();
  }
  return _client;
}
