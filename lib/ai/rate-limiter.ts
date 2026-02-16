// Rate limiting per tenant (in-memory sliding window)

type WindowEntry = {
  timestamps: number[];
};

const chatWindows = new Map<string, WindowEntry>();
const insightsWindows = new Map<string, WindowEntry>();

function checkLimit(
  windows: Map<string, WindowEntry>,
  tenantId: string,
  maxPerHour: number,
): boolean {
  const now = Date.now();
  const oneHourAgo = now - 3600_000;

  let entry = windows.get(tenantId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(tenantId, entry);
  }

  // Prune old entries
  entry.timestamps = entry.timestamps.filter((t) => t > oneHourAgo);

  if (entry.timestamps.length >= maxPerHour) {
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
