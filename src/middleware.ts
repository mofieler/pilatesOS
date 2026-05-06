import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { addSecurityHeaders } from '@/lib/security/security-headers';
import '@/lib/config/env-init';

const PUBLIC_PREFIXES = ['/login', '/register', '/verify-email', '/complete-profile'];
const PUBLIC_EXACT = ['/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return addSecurityHeaders(request, NextResponse.next());
  }

  const session = await auth();

  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    return addSecurityHeaders(request, NextResponse.redirect(loginUrl));
  }

  // New Google OAuth users must complete their profile first
  const needsProfileCompletion = (session.user as any).needsProfileCompletion;
  if (needsProfileCompletion && !pathname.startsWith('/complete-profile')) {
    return addSecurityHeaders(
      request,
      NextResponse.redirect(new URL('/complete-profile', request.url)),
    );
  }

  // /admin/* requires admin or instructor role
  if (pathname.startsWith('/admin')) {
    const role = session.user.role as string | undefined;
    if (role !== 'admin' && role !== 'instructor') {
      return addSecurityHeaders(request, NextResponse.redirect(new URL('/', request.url)));
    }
  }

  return addSecurityHeaders(request, NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
