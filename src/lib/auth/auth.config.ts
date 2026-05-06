import { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
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
      // __Host- prefix forbids Domain attribute — CSRF stays per-origin even with cross-subdomain sessions
      name: process.env.NODE_ENV === 'production' ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
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
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db
            .select()
            .from(users)
            .where(and(eq(users.email, credentials.email as string), isNull(users.deletedAt)))
            .limit(1)
            .then((rows) => rows[0]);

          if (!user || !user.passwordHash) return null;

          // Block login until email is verified
          if (!user.emailVerified) {
            console.log('[AUTH] Login blocked — email not verified:', user.email);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash,
          );

          if (!isPasswordValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image || user.avatarUrl || undefined,
            role: user.role,
            needsProfileCompletion: false,
          };
        } catch (error) {
          console.error('[AUTH] Error:', error);
          return null;
        }
      },
    }),

    Google({
      clientId: process.env.AUTH_GOOGLE_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // Only intercept Google OAuth — credentials are handled by authorize()
      if (account?.provider !== 'google') return true;
      if (!user.email) return false;

      try {
        const existing = await db
          .select()
          .from(users)
          .where(and(eq(users.email, user.email), isNull(users.deletedAt)))
          .limit(1)
          .then((rows) => rows[0]);

        if (existing) {
          // Returning Google user — populate user object for jwt callback
          user.id = existing.id;
          (user as any).role = existing.role;
          (user as any).needsProfileCompletion = false;
        } else {
          // First-time Google user — create account, mark profile incomplete
          const [newUser] = await db
            .insert(users)
            .values({
              email: user.email,
              name: user.name ?? user.email.split('@')[0],
              emailVerified: new Date(), // Google emails are pre-verified
              image: user.image ?? null,
              role: 'student',
            })
            .returning();

          user.id = newUser.id;
          (user as any).role = 'student';
          (user as any).needsProfileCompletion = true;
        }

        return true;
      } catch (error) {
        console.error('[AUTH] Google signIn error:', error);
        return false;
      }
    },

    async jwt({ token, user, trigger, session }) {
      // First sign-in: persist user data into the JWT
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? 'student';
        token.needsProfileCompletion = (user as any).needsProfileCompletion ?? false;
      }

      // Session update triggered by unstable_update() after profile completion
      if (trigger === 'update' && session?.needsProfileCompletion === false) {
        token.needsProfileCompletion = false;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session.user as any).needsProfileCompletion = token.needsProfileCompletion as boolean;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url === baseUrl || url.startsWith(`${baseUrl}/login`)) return baseUrl;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  trustHost: process.env.NODE_ENV === 'production'
    ? process.env.AUTH_TRUST_HOST === 'true'
    : true,
};
