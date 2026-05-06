import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export function addSecurityHeaders(request: NextRequest, response: NextResponse) {
  // CSP without nonces — mixing nonces + unsafe-inline causes browsers to ignore
  // unsafe-inline entirely, which blocks Next.js hydration scripts.
  const cspHeader = [
    "default-src 'self';",
    "script-src 'self' 'unsafe-inline' https:;",
    "style-src 'self' 'unsafe-inline' https:;",
    "img-src 'self' blob: data: https:;",
    "font-src 'self' data: https:;",
    "connect-src 'self' https:;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
    "upgrade-insecure-requests;",
  ].join(' ');

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigins = APP_CONFIG.ALLOWED_ORIGINS;
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

export function createSecurityResponse(request: NextRequest, response?: NextResponse) {
  const res = response || NextResponse.next();
  return addSecurityHeaders(request, res);
}
