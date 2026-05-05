'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

      // Auto-login after registration — let Auth.js handle redirect
      await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: true,
        callbackUrl: '/book',
      });
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo_transparent.png" alt="Pilates OS" className="h-16 w-auto mx-auto mb-3" />
          <h1 className="text-4xl font-bold text-stone-900 mb-2">Pilates OS</h1>
          <p className="text-stone-600">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-stone-100 p-6 rounded-lg">
          <div>
            <Label htmlFor="name" className="text-stone-900">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Jane Doe"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-stone-900">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="jane@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-stone-900">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1"
            />
            <p className="text-xs text-stone-600 mt-1">At least 8 characters</p>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-stone-900">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              required
              className="mt-1"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-sm text-stone-600 text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-stone-900 font-semibold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
