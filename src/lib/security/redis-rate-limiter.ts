import { NextRequest } from 'next/server';

// Redis client interface (to be implemented based on your Redis setup)
interface RedisClient {
  eval(script: string, numKeys: number, ...args: string[]): Promise<any>;
  del(key: string): Promise<number>;
}

// Rate limiting configuration
export interface RedisRateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for Redis keys
}

// Rate limiting result
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime?: number;
  retryAfter?: number;
}

// Fixed Window Rate Limiter using Redis
export class RedisRateLimiter {
  private redis: RedisClient;
  private config: RedisRateLimitConfig;

  constructor(redis: RedisClient, config: RedisRateLimitConfig) {
    this.redis = redis;
    this.config = {
      keyPrefix: 'rate_limit:',
      ...config,
    };
  }

  // Fixed window algorithm using Lua script for atomicity
  private fixedWindowScript = `
    local key = KEYS[1]
    local window = ARGV[1]
    local limit = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    local count = redis.call('INCR', key)
    local ttl = redis.call('PTTL', key)
    
    if count == 1 then
      redis.call('PEXPIRE', key, window)
      ttl = window
    end
    
    local remaining = math.max(0, limit - count)
    local success = remaining > 0
    
    return {count, ttl, remaining, success}
  `;

  // Sliding window algorithm for more precise rate limiting
  private slidingWindowScript = `
    local key = KEYS[1]
    local window = ARGV[1]
    local limit = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    local count = redis.call('ZCARD', key)
    
    if count < limit then
      redis.call('ZADD', key, now, now)
      redis.call('PEXPIRE', key, window)
      local remaining = limit - count - 1
      local ttl = window
      return {count + 1, ttl, remaining, true}
    else
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local retryAfter = oldest[1] and (oldest[2] - now + window) or window
      local ttl = redis.call('PTTL', key)
      return {count, ttl, 0, false, retryAfter}
    end
  `;

  async checkLimit(
    identifier: string,
    algorithm: 'fixed' | 'sliding' = 'fixed'
  ): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${identifier}`;
    const script = algorithm === 'fixed' ? this.fixedWindowScript : this.slidingWindowScript;
    
    try {
      const result = await this.redis.eval(
        script,
        1,
        key,
        this.config.windowMs.toString(),
        this.config.maxRequests.toString(),
        Date.now().toString()
      );

      const [count, ttl, remaining, success, retryAfter] = result;
      
      return {
        success: Boolean(success),
        remaining: Number(remaining),
        resetTime: ttl > 0 ? Date.now() + ttl : undefined,
        retryAfter: retryAfter ? Math.ceil(Number(retryAfter) / 1000) : undefined,
      };
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if Redis is down
      return {
        success: true,
        remaining: this.config.maxRequests,
      };
    }
  }

  // Reset rate limit for a specific identifier
  async resetLimit(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}${identifier}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Error resetting rate limit:', error);
    }
  }
}

// Factory function to create rate limiters
export function createRedisRateLimiter(
  redis: RedisClient,
  config: RedisRateLimitConfig
) {
  return new RedisRateLimiter(redis, config);
}

// Predefined rate limiters for different endpoints
export function createAuthRateLimiter(redis: RedisClient) {
  return createRedisRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    keyPrefix: 'auth_rate_limit:',
  });
}

export function createBookingRateLimiter(redis: RedisClient) {
  return createRedisRateLimiter(redis, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    keyPrefix: 'booking_rate_limit:',
  });
}

export function createPurchaseRateLimiter(redis: RedisClient) {
  return createRedisRateLimiter(redis, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 purchases per minute
    keyPrefix: 'purchase_rate_limit:',
  });
}

// Helper function to extract client identifier
export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from session if available
  const userId = request.headers.get('x-user-id');
  if (userId) return `user:${userId}`;
  
  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || 
            request.headers.get('x-real-ip') || 
            'unknown';
  
  return `ip:${ip}`;
}

// Middleware helper for Next.js API routes
export function createRateLimitMiddleware(limiter: RedisRateLimiter) {
  return async (request: NextRequest, algorithm: 'fixed' | 'sliding' = 'fixed') => {
    const identifier = getClientIdentifier(request);
    const result = await limiter.checkLimit(identifier, algorithm);
    
    return {
      allowed: result.success,
      headers: {
        'X-RateLimit-Limit': limiter['config'].maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime?.toString() || '',
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
      },
    };
  };
}
