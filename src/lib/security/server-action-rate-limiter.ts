/**
 * Rate limiting for Server Actions
 * Uses IP-based limiting with in-memory store (sufficient for single-instance MVP)
 * For multi-instance deployment, upgrade to Redis-based limiting
 */

import { headers } from 'next/headers';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes

/**
 * Get client IP from headers (Next.js 16 - must await headers())
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] ||
             headersList.get('x-real-ip') ||
             'unknown';
  return ip;
}

/**
 * Check rate limit for a given action and identifier
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<{ success: boolean; remaining: number; resetTime?: number }> {
  const ip = await getClientIP();
  const key = `${config.keyPrefix}:${ip}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return { success: true, remaining: config.maxRequests - 1, resetTime: entry.resetTime };
  }

  // Check limit
  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetTime: entry.resetTime };
  }

  // Increment counter
  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Predefined rate limiting configs
export const authRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyPrefix: 'auth',
};

export const registerRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 registrations per 15 minutes
  keyPrefix: 'register',
};
