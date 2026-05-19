/**
 * Unified rate-limit store. Picks Redis when REDIS_URL is set, falls back to
 * an in-memory Map otherwise (single-process dev). Both rate limiters in this
 * folder (rate-limiter.ts for API routes, server-action-rate-limiter.ts for
 * server actions) consult this store so a multi-instance deploy actually
 * shares state.
 *
 * The Redis algorithm is the standard fixed-window: INCR a key, PEXPIRE on the
 * first hit. Atomic per Redis command semantics; no Lua needed for this
 * coarse window.
 */

import type { RedisClientType } from 'redis';

export interface HitResult {
  /** true if the request fits within the limit */
  success: boolean;
  /** how many hits are still available in the current window */
  remaining: number;
  /** epoch ms when the current window ends */
  resetTime: number;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface MemEntry {
  count: number;
  resetTime: number;
}

const memStore = new Map<string, MemEntry>();

function memHit(key: string, windowMs: number, maxRequests: number): HitResult {
  const now = Date.now();
  let entry = memStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    memStore.set(key, entry);
    return { success: true, remaining: maxRequests - 1, resetTime: entry.resetTime };
  }
  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetTime: entry.resetTime };
  }
  entry.count += 1;
  return { success: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

// Periodic cleanup for the mem store. No-op when Redis is in use.
const CLEANUP_INTERVAL = 5 * 60 * 1000;
if (typeof setInterval === 'function') {
  const globalKey = '__pilatesos_rate_limit_cleanup';
  if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
    clearInterval((globalThis as any)[globalKey]);
  }
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of memStore.entries()) {
      if (now > e.resetTime) memStore.delete(k);
    }
  }, CLEANUP_INTERVAL);
  interval.unref?.();
  if (typeof globalThis !== 'undefined') {
    (globalThis as any)[globalKey] = interval;
  }
}

// ─── Redis connection (lazy, cached) ─────────────────────────────────────────

type RedisClient = RedisClientType<any, any, any>;

let redisPromise: Promise<RedisClient | null> | null = null;

async function getRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisPromise) return redisPromise;

  redisPromise = (async () => {
    try {
      const { createClient } = await import('redis');
      const client = createClient({
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
      }) as RedisClient;
      client.on('error', (err) => {
        console.warn('[rate-limit] Redis error, fall-through to mem store:', err?.message ?? err);
        // Reset cached promise so next request creates a fresh connection
        redisPromise = null;
        client.disconnect().catch(() => {});
      });
      await client.connect();
      console.info('[rate-limit] Redis connected');
      return client;
    } catch (err) {
      console.warn('[rate-limit] Redis connect failed, using in-memory store:', err);
      return null;
    }
  })();

  return redisPromise;
}

async function redisHit(
  client: RedisClient,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<HitResult> {
  // Coalesce key prefix so all rate-limit keys live in one namespace —
  // makes flushing easy if needed.
  const fullKey = `pilatesos:rl:${key}`;
  const count = await client.incr(fullKey);
  if (count === 1) {
    await client.pExpire(fullKey, windowMs);
  }
  let pttl = await client.pTTL(fullKey);
  if (pttl < 0) {
    // Key has no TTL (race with expiry) — set one defensively.
    await client.pExpire(fullKey, windowMs);
    pttl = windowMs;
  }
  const resetTime = Date.now() + pttl;
  if (count > maxRequests) {
    return { success: false, remaining: 0, resetTime };
  }
  return { success: true, remaining: maxRequests - count, resetTime };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register one hit against the limiter. Returns whether the call is allowed
 * and how much budget is left in the current window. Falls back to the
 * in-memory store on any Redis error so the limiter never fails open by
 * accident.
 */
export async function rateLimitHit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<HitResult> {
  const redis = await getRedis().catch(() => null);
  if (!redis) return memHit(key, windowMs, maxRequests);
  try {
    return await redisHit(redis, key, windowMs, maxRequests);
  } catch (err) {
    console.warn('[rate-limit] Redis op failed, fall-through to mem store:', err);
    return memHit(key, windowMs, maxRequests);
  }
}
