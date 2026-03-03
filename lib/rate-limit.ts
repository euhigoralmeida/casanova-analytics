/**
 * In-memory rate limiter for login brute-force protection.
 * Tracks failed attempts per key (IP or email).
 * After MAX_ATTEMPTS within WINDOW_MS, blocks for BLOCK_MS.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_MS = 15 * 60 * 1000; // 15 minute block

type Entry = { count: number; firstAttempt: number; blockedUntil?: number };

const store = new Map<string, Entry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.blockedUntil && now > entry.blockedUntil) {
      store.delete(key);
    } else if (now - entry.firstAttempt > WINDOW_MS) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Check if a key is currently rate-limited.
 * Returns { blocked: true, retryAfterMs } if blocked.
 */
export function isRateLimited(key: string): { blocked: boolean; retryAfterMs?: number } {
  const entry = store.get(key);
  if (!entry) return { blocked: false };

  const now = Date.now();

  if (entry.blockedUntil) {
    if (now < entry.blockedUntil) {
      return { blocked: true, retryAfterMs: entry.blockedUntil - now };
    }
    // Block expired, reset
    store.delete(key);
    return { blocked: false };
  }

  return { blocked: false };
}

/**
 * Record a failed login attempt. Returns true if the key is now blocked.
 */
export function recordFailedAttempt(key: string): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  entry.count += 1;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    return true;
  }

  return false;
}

/** Clear rate limit for a key (e.g., on successful login). */
export function clearRateLimit(key: string): void {
  store.delete(key);
}
