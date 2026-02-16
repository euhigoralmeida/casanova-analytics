// AI configuration + feature flags

export const AI_CONFIG = {
  enabled: process.env.AI_ENABLED !== "false",

  chat: {
    model: (process.env.AI_CHAT_MODEL || "claude-sonnet-4-5-20250929") as string,
    maxTokens: 1024,
    temperature: 0.3,
  },

  insights: {
    model: (process.env.AI_INSIGHTS_MODEL || "claude-haiku-4-5-20251001") as string,
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
} as const;
