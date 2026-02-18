// AI configuration + feature flags
// Uses lazy proxy to read env vars at runtime (not at import time)

export function getAIConfig() {
  return {
    enabled: process.env.AI_ENABLED !== "false",

    chat: {
      model: process.env.AI_CHAT_MODEL || "gemini-2.0-flash",
      maxTokens: 1024,
      temperature: 0.3,
    },

    insights: {
      model: process.env.AI_INSIGHTS_MODEL || "gemini-2.0-flash",
      maxTokens: 512,
      temperature: 0.2,
    },

    rateLimit: {
      chatPerHour: parseInt(process.env.AI_CHAT_RATE_LIMIT || "30", 10),
      insightsPerHour: parseInt(process.env.AI_INSIGHTS_RATE_LIMIT || "12", 10),
    },

    strategic: {
      model: process.env.AI_STRATEGIC_MODEL || "gemini-2.0-flash",
      maxTokens: 2048,
      temperature: 0.35,
    },

    provider: (process.env.LLM_PROVIDER || "gemini") as "gemini" | "claude",

    cache: {
      insightsTtlMs: parseInt(process.env.AI_INSIGHTS_CACHE_TTL || "300", 10) * 1000,
      advisorTtlMs: 10 * 60 * 1000, // 10 min
    },
  };
}

// Lazy proxy — reads env vars on access, not at import time
export const AI_CONFIG = new Proxy({} as ReturnType<typeof getAIConfig>, {
  get(_target, prop) {
    return getAIConfig()[prop as keyof ReturnType<typeof getAIConfig>];
  },
});
