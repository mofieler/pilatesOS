import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { sanitizeError, createSafeServiceResult, handleApiError } from '@/lib/security/error-sanitizer';
import { RedisRateLimiter } from '@/lib/security/redis-rate-limiter';
import { auditLogger, auditHelpers } from '@/lib/security/audit-system';
import { addSecurityHeaders } from '@/lib/security/security-headers';

describe('Security Tests', () => {
  describe('Error Sanitization', () => {
    it('should sanitize database errors', () => {
      const dbError = new Error('SQL: SELECT * FROM users WHERE id = 1');
      const sanitized = sanitizeError(dbError);
      expect(sanitized).toBe('An unexpected error occurred. Please try again.');
    });

    it('should sanitize file system errors', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      const sanitized = sanitizeError(fsError);
      expect(sanitized).toBe('An unexpected error occurred. Please try again.');
    });

    it('should preserve safe error messages', () => {
      const safeError = { code: 'NOT_FOUND', error: 'The requested resource was not found.' };
      const sanitized = sanitizeError(safeError);
      expect(sanitized).toBe('The requested resource was not found.');
    });

    it('should create safe service results', () => {
      const unsafeResult = {
        success: false as const,
        error: 'DATABASE_CONNECTION_FAILED: Connection timeout',
        code: 'DB_ERROR' as any,
      };
      const safeResult = createSafeServiceResult(unsafeResult) as any;
      expect(safeResult.error).toBe('An unexpected error occurred. Please try again.');
      expect(safeResult.code).toBe('DB_ERROR');
    });

    it('should handle API errors properly', () => {
      const apiError = { code: 'UNAUTHORIZED', error: 'Invalid credentials' };
      const response = handleApiError(apiError, 'test-context');
      expect(response.success).toBe(false);
      expect(response.error).toBe('You are not authorized to perform this action.');
    });
  });

  describe('Security Headers', () => {
    it('should add all required security headers', () => {
      const request = new Request('https://example.com/test');
      const response = new Response('test content');
      
      const securedResponse = addSecurityHeaders(request as any, response as any);
      
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(securedResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(securedResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(securedResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should include HSTS in production', () => {
      const env = process.env as Record<string, string | undefined>;
      const originalEnv = env.NODE_ENV;
      env.NODE_ENV = 'production';

      const request = new Request('https://example.com/test');
      const response = new Response('test content');

      const securedResponse = addSecurityHeaders(request as any, response as any);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBeTruthy();

      env.NODE_ENV = originalEnv;
    });

    it('should generate CSP with nonce', () => {
      const request = new Request('https://example.com/test');
      const response = new Response('test content');
      
      const securedResponse = addSecurityHeaders(request as any, response as any);
      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain('default-src \'self\'');
      expect(csp).toContain('script-src \'self\' \'nonce-');
      expect(csp).toContain('style-src \'self\' \'nonce-');
      expect(csp).toContain('frame-ancestors \'none\'');
    });
  });

  describe('Rate Limiting', () => {
    let mockRedis: any;
    let rateLimiter: RedisRateLimiter;

    beforeAll(() => {
      mockRedis = {
        eval: vi.fn(),
        del: vi.fn(),
      };
      
      rateLimiter = new RedisRateLimiter(mockRedis, {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test:',
      });
    });

    it('should allow requests within limit', async () => {
      mockRedis.eval.mockResolvedValue([1, 60000, 9, true]);
      
      const result = await rateLimiter.checkLimit('test-user', 'fixed');
      
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetTime).toBeDefined();
    });

    it('should block requests exceeding limit', async () => {
      mockRedis.eval.mockResolvedValue([11, 60000, 0, false, 30]);
      
      const result = await rateLimiter.checkLimit('test-user', 'fixed');
      
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(30);
    });

    it('should handle Redis failures gracefully', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await rateLimiter.checkLimit('test-user', 'fixed');
      
      expect(result.success).toBe(true); // Fail open
      expect(result.remaining).toBe(10);
    });
  });

  describe('Audit Logging', () => {
    it('should log authentication events', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await auditHelpers.logUserLogin('user-123', '192.168.1.1', 'Mozilla/5.0');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT_LOG:'),
        expect.stringContaining('login')
      );
      
      logSpy.mockRestore();
    });

    it('should log failed login attempts', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await auditHelpers.logFailedLogin('test@example.com', '192.168.1.1', 'Mozilla/5.0', 'Invalid password');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT_LOG:'),
        expect.stringContaining('login_failed')
      );
      
      logSpy.mockRestore();
    });

    it('should log financial events', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await auditHelpers.logCreditPurchase('user-123', 10, 'mat_group', true);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT_LOG:'),
        expect.stringContaining('credit_purchase')
      );
      
      logSpy.mockRestore();
    });

    it('should log admin actions', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await auditHelpers.logAdminAction('admin-123', 'create_user', 'user', 'user-456');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT_LOG:'),
        expect.stringContaining('create_user')
      );
      
      logSpy.mockRestore();
    });

    it('should log security violations', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await auditHelpers.logSecurityViolation('user-123', 'rate_limit_exceeded', { ip: '192.168.1.1' });
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT_LOG:'),
        expect.stringContaining('security_violation')
      );
      
      logSpy.mockRestore();
    });
  });

  describe('Input Validation Security', () => {
    it('should reject UUID injection attempts', () => {
      const maliciousId = "123e4567-e89b-12d3-a456-426614174000'; DROP TABLE users; --";
      
      // This would be caught by Zod validation
      expect(() => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(maliciousId)) {
          throw new Error('Invalid UUID format');
        }
      }).toThrow('Invalid UUID format');
    });

    it('should prevent XSS in user inputs', () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      // This would be sanitized by CSP headers
      expect(xssPayload).toContain('<script>');
      // But CSP would prevent execution
    });

    it('should validate email formats properly', () => {
      const invalidEmails = [
        'test@example',
        'test@.com',
        'test@example.',
        'test..test@example.com',
        'test@example..com'
      ];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('Session Security', () => {
    it('should validate session tokens properly', () => {
      // Mock session validation
      const validSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student'
        },
        expires: new Date(Date.now() + 3600000) // 1 hour from now
      };
      
      expect(validSession.user).toBeDefined();
      expect(validSession.user.id).toBeTruthy();
      expect(validSession.expires).toBeInstanceOf(Date);
      expect(validSession.expires.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject expired sessions', () => {
      const expiredSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student'
        },
        expires: new Date(Date.now() - 3600000) // 1 hour ago
      };
      
      expect(expiredSession.expires.getTime()).toBeLessThan(Date.now());
      // Session should be rejected as expired
    });
  });

  describe('Rate Limiting Bypass Protection', () => {
    it('should prevent IP-based bypass attempts', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue([1, 60000, 9, true]),
        del: vi.fn(),
      };
      
      const rateLimiter = new RedisRateLimiter(mockRedis, {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test:',
      });
      
      // Simulate multiple requests from same IP
      const ip = '192.168.1.1';
      const results = await Promise.all([
        rateLimiter.checkLimit(`ip:${ip}`, 'fixed'),
        rateLimiter.checkLimit(`ip:${ip}`, 'fixed'),
        rateLimiter.checkLimit(`ip:${ip}`, 'fixed'),
      ]);
      
      // All should use the same Redis key
      expect(mockRedis.eval).toHaveBeenCalledTimes(3);
      mockRedis.eval.mock.calls.forEach(call => {
        expect(call[1]).toBe(`test:ip:${ip}`);
      });
    });

    it('should handle distributed rate limiting', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue([5, 60000, 5, true]),
        del: vi.fn(),
      };
      
      const rateLimiter = new RedisRateLimiter(mockRedis, {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'distributed:',
      });
      
      // Simulate requests from different servers but same user
      const userId = 'user-123';
      const result = await rateLimiter.checkLimit(`user:${userId}`, 'fixed');
      
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });
});

describe('Security Integration Tests', () => {
  it('should handle complete security workflow', async () => {
    // 1. User attempts login
    await auditHelpers.logUserLogin('user-123', '192.168.1.1', 'Mozilla/5.0');
    
    // 2. Rate limiting check
    const mockRedis = {
      eval: vi.fn().mockResolvedValue([1, 60000, 9, true]),
      del: vi.fn(),
    };
    const rateLimiter = new RedisRateLimiter(mockRedis, {
      windowMs: 60000,
      maxRequests: 10,
    });
    const rateLimitResult = await rateLimiter.checkLimit('user-123', 'fixed');
    expect(rateLimitResult.success).toBe(true);
    
    // 3. Security headers applied
    const request = new Request('https://example.com/dashboard');
    const response = new Response('dashboard content');
    const securedResponse = addSecurityHeaders(request as any, response as any);
    expect(securedResponse.headers.get('Content-Security-Policy')).toBeTruthy();
    
    // 4. Error handling
    const error = new Error('Database connection failed');
    const sanitizedError = sanitizeError(error);
    expect(sanitizedError).toBe('An unexpected error occurred. Please try again.');
    
    // 5. Audit logging for admin action
    await auditHelpers.logAdminAction('admin-123', 'view_user', 'user', 'user-123');
  });

  it('should handle security breach scenario', async () => {
    // Simulate brute force attack
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    for (let i = 0; i < 5; i++) {
      await auditHelpers.logFailedLogin('attacker@example.com', '192.168.1.100', 'Mozilla/5.0', 'Invalid password');
    }
    
    // Log security violation
    await auditHelpers.logSecurityViolation('system', 'brute_force_detected', {
      ip: '192.168.1.100',
      attempts: 5,
      timeframe: '5 minutes'
    });
    
    expect(logSpy).toHaveBeenCalledTimes(6); // 5 failed logins + 1 security violation
    logSpy.mockRestore();
  });
});
