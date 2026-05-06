import { CircleCheck } from 'lucide-react';
import Link from 'next/link';

export default function EmailVerifiedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center size-20 rounded-full bg-[#4a7c4a]/10 mb-6">
          <CircleCheck className="size-10 text-[#4a7c4a]" />
        </div>

        <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">Email verified!</h1>
        <p className="text-[#6b3d32] mb-6 leading-relaxed">
          Your email address has been successfully verified. You can now sign in to your account and start booking classes.
        </p>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 text-left mb-6">
          <p className="text-sm text-[#6b3d32] font-medium mb-3">What's next?</p>
          <ul className="text-sm text-[#8b6b5c] space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Sign in to your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Browse available Pilates classes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4a7c4a] mt-0.5">✓</span>
              <span>Book your first session</span>
            </li>
          </ul>
        </div>

        <Link
          href="/login?verified=true"
          className="inline-flex items-center justify-center rounded-xl bg-[#4e2b22] px-6 py-3 text-sm font-semibold text-[#faf9f7] shadow-sm hover:bg-[#6b3d32] transition-colors"
        >
          Sign in now
        </Link>

        <p className="text-sm text-[#8b6b5c] mt-6">
          Need help?{' '}
          <a href="mailto:support@pilateq.de" className="text-[#4e2b22] font-medium hover:text-[#6b3d32] transition-colors">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
