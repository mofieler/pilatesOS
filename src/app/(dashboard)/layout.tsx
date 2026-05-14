import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { ProfileCompletionOverlay } from '@/components/shared/ProfileCompletionOverlay';
import { CookieNotice } from '@/components/shared/CookieNotice';
import { BillingReminderPopup } from '@/modules/billing/components/BillingReminderPopup';
import { UserMobileNav } from './components/UserMobileNav';
import { DesktopNavLinks } from './components/DesktopNavLinks';

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

export default async function DashboardLayout({ children }:  { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect('/login');

  const needsProfileCompletion = (session.user as any)?.needsProfileCompletion === true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand + nav links */}
          <div className="flex items-center gap-4">
          {/* Brand logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-bold tracking-tight text-[#4e2b22] hover:text-[#6b3d32] transition-colors"
            >
              <img src="/logo.png" alt="Pilateq" className="h-8 w-auto" />
              <span className="hidden xs:inline">Pilateq</span>
            </Link>

            {/* Mobile hamburger — portal handles the panel */}
            <UserMobileNav />

            {/* Desktop nav links — active state handled by DesktopNavLinks (client) */}
            <DesktopNavLinks />
          </div>

          {/* Right: email + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-2">
              <div className="size-7 rounded-full bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] flex items-center justify-center text-[#faf9f7] text-xs font-semibold">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0)}
              </div>
              <p className="text-xs font-medium text-[#4e2b22] truncate max-w-[140px]">
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

      <main className="max-w-7xl mx-auto p-6 flex-1">{children}</main>

      <footer className="border-t border-[#ede8e5]/60 bg-[#faf9f7]/80 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center justify-between">
          <p className="text-xs text-[#a6856f]">
            &copy; {new Date().getFullYear()} Paquita Pilates Reformer GbR
          </p>
          <div className="flex gap-4 text-xs flex-wrap">
            <Link href="/impressum"      className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Impressum</Link>
            <Link href="/datenschutz"    className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Privacy Policy</Link>
            <Link href="/agb"            className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">T&amp;Cs</Link>
            <Link href="/widerrufsrecht" className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Cancellation Policy</Link>
          </div>
        </div>
      </footer>

      {needsProfileCompletion && (
        <ProfileCompletionOverlay initialName={session.user?.name ?? ''} />
      )}
      <CookieNotice />
      <BillingReminderPopup />
    </div>
  );
}
