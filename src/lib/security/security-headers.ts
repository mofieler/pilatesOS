import { NextRequest, NextResponse } from 'next/server';

export function addSecurityHeaders(request: NextRequest, response: NextResponse) {
  // Generate nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Content Security Policy - Prevents XSS and data injection
  // Build CSP with proper template literal for nonce interpolation
  const cspHeader = [
    "default-src 'self';",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:;`,
    `style-src 'self' 'nonce-${nonce}' https:;`,
    "img-src 'self' blob: data: https:;",
    "font-src 'self' https:;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
    "block-all-mixed-content;",
    "upgrade-insecure-requests;",
  ].join(' ').replace(/\s{2,}/g, ' ').trim();

  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
    response.headers.set('Access-Control-Allow-Methods', 
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-Requested-With'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  // Pass nonce to components via header
  response.headers.set('x-nonce', nonce);

  return response;
}

export function createSecurityResponse(request: NextRequest, response?: NextResponse) {
  const res = response || NextResponse.next();
  return addSecurityHeaders(request, res);
}
