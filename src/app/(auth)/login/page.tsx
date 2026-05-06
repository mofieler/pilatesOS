'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function roleRedirect(role: string | undefined | null): string {
  if (role === 'admin' || role === 'instructor') return '/admin';
  return '/';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const verified = searchParams.get('verified');
    const reset = searchParams.get('reset');
    const errorParam = searchParams.get('error');

    if (verified === 'true') {
      setInfo('Email verified! You can now sign in.');
    } else if (reset === 'true') {
      setInfo('Password reset successfully! You can now sign in.');
    } else if (errorParam === 'expired_token') {
      setError('Verification link expired. Please register again.');
    } else if (errorParam === 'invalid_token') {
      setError('Invalid verification link.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          'Invalid email or password. If you just registered, please check your email for a verification link.',
        );
        return;
      }

      if (result?.ok) {
        const session = await getSession();
        router.push(roleRedirect(session?.user?.role as string | undefined));
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {info && (
        <p className="text-sm text-[#4a7c4a] bg-[#6b8e6b]/10 border border-[#6b8e6b]/20 p-3 rounded-xl mb-4 text-center">
          {info}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gradient-to-br from-[#ede8e5]/60 to-[#faf9f7]/80 p-6 rounded-2xl border border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)] backdrop-blur-sm"
      >
        <div>
          <Label htmlFor="email" className="text-[#4e2b22] font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl"
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-[#4e2b22] font-medium">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] focus:ring-[#c4a88a]/20 rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeSlashIcon className="size-5" />
                : <EyeIcon className="size-5" />}
            </button>
          </div>
          <a
            href="/forgot-password"
            className="text-sm text-[#6b3d32] hover:text-[#4e2b22] transition-colors block mt-2"
          >
            Forgot password?
          </a>
        </div>

        {error && (
          <p className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl">{error}</p>
        )}

        <Button type="submit" variant="boutique" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 flex items-center">
        <div className="flex-1 border-t border-[#ede8e5]" />
        <span className="px-3 text-sm text-[#8b6b5c]">or</span>
        <div className="flex-1 border-t border-[#ede8e5]" />
      </div>

      <Button
        variant="outline"
        className="w-full mt-4 border-[#ede8e5] bg-[#faf9f7]/60 text-[#4e2b22] hover:bg-[#ede8e5]/60 rounded-xl"
        onClick={() => signIn('google', { redirect: true, redirectTo: '/' })}
        disabled={loading}
      >
        Continue with Google
      </Button>

      <p className="text-sm text-[#8b6b5c] text-center mt-6">
        Don&apos;t have an account?{' '}
        <a
          href="/register"
          className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors"
        >
          Sign up
        </a>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image 
              src="/logo.png" 
              alt="Pilateq" 
              width={64}
              height={64}
              className="h-16 w-auto mx-auto mb-3" 
              priority={true}
            />
          <h1 className="text-4xl font-bold text-[#4e2b22] mb-2">Pilateq</h1>
          <p className="text-[#8b6b5c]">Sign in to your account</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
