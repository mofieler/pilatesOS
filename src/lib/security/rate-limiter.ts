import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimit(request: NextRequest): { success: boolean; resetTime?: number } {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    const key = `${clientIp}:${request.nextUrl.pathname}`;
    const now = Date.now();
    
    // Get or create entry
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // New window
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(key, entry);
      return { success: true, resetTime: entry.resetTime };
    }
    
    // Check limit
    if (entry.count >= config.maxRequests) {
      return { success: false, resetTime: entry.resetTime };
    }
    
    // Increment counter
    entry.count++;
    return { success: true, resetTime: entry.resetTime };
  };
}

// Predefined rate limiters for different endpoints
export const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 }); // 5 requests per 15 minutes
export const bookingRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }); // 10 requests per minute
export const purchaseRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 3 }); // 3 purchases per minute

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes
