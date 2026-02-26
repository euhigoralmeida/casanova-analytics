// Rate limiting per tenant (in-memory sliding window)

type WindowEntry = {
  timestamps: number[];
};

const chatWindows = new Map<string, WindowEntry>();
const insightsWindows = new Map<string, WindowEntry>();
const apiWindows = new Map<string, WindowEntry>();

function checkLimit(
  windows: Map<string, WindowEntry>,
  tenantId: string,
  max: number,
  windowMs: number = 3600_000,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = windows.get(tenantId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(tenantId, entry);
  }

  // Prune old entries
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= max) {
    return false; // rate limited
  }

  entry.timestamps.push(now);
  return true;
}

export function checkChatLimit(tenantId: string, maxPerHour: number): boolean {
  return checkLimit(chatWindows, tenantId, maxPerHour);
}

export function checkInsightsLimit(tenantId: string, maxPerHour: number): boolean {
  return checkLimit(insightsWindows, tenantId, maxPerHour);
}

/** Sliding window rate limit for data API routes (default: 120 req/min) */
export function checkApiLimit(tenantId: string, maxPerMinute: number = 120): boolean {
  return checkLimit(apiWindows, tenantId, maxPerMinute, 60_000);
}
