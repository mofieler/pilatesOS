'use client';

import { XCircle, Clock, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerificationFailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const isExpired = reason === 'expired';
  const isInvalid = reason === 'invalid' || !reason;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className={`inline-flex items-center justify-center size-20 rounded-full mb-6 ${isExpired ? 'bg-[#c4a88a]/20' : 'bg-[#c45c4a]/10'}`}>
          {isExpired ? (
            <Clock className="size-10 text-[#8b5a3c]" />
          ) : (
            <XCircle className="size-10 text-[#c45c4a]" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">
          {isExpired ? 'Link expired' : 'Verification failed'}
        </h1>
        <p className="text-[#6b3d32] mb-6 leading-relaxed">
          {isExpired
            ? "This verification link has expired. For security reasons, verification links are only valid for 24 hours."
            : "We couldn't verify your email address. The link may be invalid or has already been used."}
        </p>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 text-left mb-6">
          {isExpired ? (
            <>
              <p className="text-sm text-[#6b3d32] font-medium mb-3">What you can do:</p>
              <ul className="text-sm text-[#8b6b5c] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#4e2b22] mt-0.5">1.</span>
                  <span>Go to the login page and try signing in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4e2b22] mt-0.5">2.</span>
                  <span>If your account isn't verified, request a new verification email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4e2b22] mt-0.5">3.</span>
                  <span>Or create a new account if needed</span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-sm text-[#6b3d32] font-medium mb-3">Possible reasons:</p>
              <ul className="text-sm text-[#8b6b5c] space-y-2">
                <li className="flex items-start gap-2">
                  <Mail className="size-4 mt-0.5 text-[#8b6b5c]" />
                  <span>The link was already used</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="size-4 mt-0.5 text-[#8b6b5c]" />
                  <span>The link is malformed or incomplete</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="size-4 mt-0.5 text-[#8b6b5c]" />
                  <span>Your account may already be verified</span>
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4e2b22] px-6 py-3 text-sm font-semibold text-[#faf9f7] shadow-sm hover:bg-[#6b3d32] transition-colors"
          >
            Go to sign in
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl border border-[#c4a88a]/50 bg-transparent px-6 py-3 text-sm font-semibold text-[#4e2b22] hover:bg-[#ede8e5]/60 transition-colors"
          >
            Create new account
          </Link>
        </div>

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

export default function VerificationFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center size-20 rounded-full bg-[#c45c4a]/10 mb-6 animate-pulse">
            <XCircle className="size-10 text-[#c45c4a]" />
          </div>
          <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">Loading...</h1>
        </div>
      </div>
    }>
      <VerificationFailedContent />
    </Suspense>
  );
}
