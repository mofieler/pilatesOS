import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { AdminNav } from './components/AdminNav';

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin' && session.user.role !== 'instructor') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1]">
      <nav className="sticky top-0 z-50 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand + nav links */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Pilateq" className="h-8 w-auto" />
            <h1 className="text-xl font-bold text-[#4e2b22]">Pilateq</h1>
            <span className="rounded-full bg-[#4e2b22] px-3 py-1 text-xs font-semibold text-[#faf9f7]">
              Admin
            </span>

            <AdminNav />
          </div>

          {/* Right: email + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-2">
              <div className="size-7 rounded-full bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] flex items-center justify-center text-[#faf9f7] text-xs font-semibold">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0)}
              </div>
              <p className="text-xs font-semibold text-[#4e2b22] truncate max-w-[140px]">
                {session.user?.email}
              </p>
            </div>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-[#c4a88a]/50 bg-[#faf9f7] px-3 py-2 text-xs font-semibold text-[#4e2b22] transition-all hover:bg-[#4e2b22] hover:text-[#faf9f7] hover:border-[#4e2b22] flex items-center gap-1.5"
              >
                <ArrowRightIcon />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  );
}
