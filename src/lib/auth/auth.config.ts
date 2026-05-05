import { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const authConfig: NextAuthConfig = {
  // JWT strategy — required for Credentials provider.
  // The Drizzle adapter (DB sessions) only works for OAuth providers like Google.
  // With JWT, the session lives in a signed cookie, not the sessions table.
  session: { strategy: 'jwt' },

  // Cookie configuration for cross-subdomain authentication
  // Set AUTH_COOKIE_DOMAIN=.pilateq.de for multi-tenant subdomains
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined, // e.g., .pilateq.de for subdomains
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      },
    },
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1)
          .then((rows) => rows[0]);

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image || user.avatarUrl || undefined,
          role: user.role,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
      // Removed allowDangerousEmailAccountLinking for security
      // Users will need to manually link accounts via proper flow
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist id and role into the JWT on first sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? 'student';
      }
      return token;
    },
    async session({ session, token }) {
      // Expose id and role from JWT to the session object
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard (root route) after successful sign in
      if (url === baseUrl || url.startsWith(`${baseUrl}/login`)) {
        return baseUrl;
      }
      // Allow relative URLs and URLs within the same origin
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  trustHost: process.env.NODE_ENV === 'production' 
    ? process.env.AUTH_TRUST_HOST === 'true' 
    : true, // Allow localhost in development
};
