'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerAction } from '@/modules/users/actions/register.action';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await registerAction(formData);

      if (!result.success) {
        setError(result.error || 'Registration failed');
        return;
      }

      // Redirect to "check your email" page — no auto-login until verified
      router.push('/verify-email');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Pilateq" className="h-16 w-auto mx-auto mb-3" />
          <h1 className="text-4xl font-bold text-[#4e2b22] mb-2">Pilateq</h1>
          <p className="text-[#8b6b5c]">Create your account</p>
        </div>

        {/* Google sign-up */}
        <Button
          variant="outline"
          className="w-full mb-4 border-[#ede8e5] bg-[#faf9f7]/60 text-[#4e2b22] hover:bg-[#ede8e5]/60 rounded-xl"
          onClick={() => signIn('google', { redirect: true, redirectTo: '/complete-profile' })}
          disabled={loading}
        >
          Continue with Google
        </Button>

        <div className="flex items-center mb-4">
          <div className="flex-1 border-t border-[#ede8e5]" />
          <span className="px-3 text-sm text-[#8b6b5c]">or sign up with email</span>
          <div className="flex-1 border-t border-[#ede8e5]" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-gradient-to-br from-[#ede8e5]/60 to-[#faf9f7]/80 p-6 rounded-2xl border border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]"
        >
          <div>
            <Label htmlFor="name" className="text-[#4e2b22] font-medium">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Jane Doe"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-[#4e2b22] font-medium">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="jane@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1.5 bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-[#4e2b22] font-medium">Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
                className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl pr-10"
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
            <p className="text-xs text-[#8b6b5c] mt-1">At least 8 characters</p>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-[#4e2b22] font-medium">Confirm Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                required
                className="bg-[#faf9f7]/80 border-[#ede8e5] text-[#4e2b22] placeholder:text-[#8b6b5c]/50 focus:border-[#c4a88a] rounded-xl pr-10"
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
          </div>

          {error && (
            <p className="text-sm text-[#c45c4a] bg-[#c45c4a]/10 p-3 rounded-xl">{error}</p>
          )}

          <Button type="submit" variant="boutique" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-[#8b6b5c] text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
