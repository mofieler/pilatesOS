import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { addSecurityHeaders } from '@/lib/security/security-headers';
import '@/lib/config/env-init'; // Initialize environment validation

// Routes that anyone can visit without a session
const PUBLIC_PREFIXES = ['/login', '/register'];
// The exact landing page is also public
const PUBLIC_EXACT = ['/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
  const response = NextResponse.next();
  return addSecurityHeaders(request, response);
  }

  // Everything else requires a valid session
  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(request, response);
  }

  // /admin/* additionally requires admin or instructor role
  if (pathname.startsWith('/admin')) {
    const role = session.user.role as string | undefined;
    if (role !== 'admin' && role !== 'instructor') {
      const response = NextResponse.redirect(new URL('/', request.url));
      return addSecurityHeaders(request, response);
    }
  }

  const response = NextResponse.next();
  return addSecurityHeaders(request, response);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
