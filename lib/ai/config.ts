// AI configuration + feature flags
// Uses getter functions to read env vars lazily at runtime (not at import time)

export function getAIConfig() {
  return {
    enabled: process.env.AI_ENABLED !== "false",

    chat: {
      model: process.env.AI_CHAT_MODEL || "claude-sonnet-4-5-20250929",
      maxTokens: 1024,
      temperature: 0.3,
    },

    insights: {
      model: process.env.AI_INSIGHTS_MODEL || "claude-haiku-4-5-20251001",
      maxTokens: 512,
      temperature: 0.2,
    },

    rateLimit: {
      chatPerHour: parseInt(process.env.AI_CHAT_RATE_LIMIT || "30", 10),
      insightsPerHour: parseInt(process.env.AI_INSIGHTS_RATE_LIMIT || "12", 10),
    },

    cache: {
      insightsTtlMs: parseInt(process.env.AI_INSIGHTS_CACHE_TTL || "300", 10) * 1000,
    },
  };
}

// Backwards compat — lazy proxy
export const AI_CONFIG = new Proxy({} as ReturnType<typeof getAIConfig>, {
  get(_target, prop) {
    return getAIConfig()[prop as keyof ReturnType<typeof getAIConfig>];
  },
});
