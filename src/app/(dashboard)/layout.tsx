import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { ProfileCompletionOverlay } from '@/components/shared/ProfileCompletionOverlay';
import { CookieNotice } from '@/components/shared/CookieNotice';
import { BillingReminderPopup } from '@/modules/billing/components/BillingReminderPopup';
import { UserMobileNav } from './components/UserMobileNav';

// Heroicons-style SVG icons - professional, consistent
const DashboardIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const TicketIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M2.25 12V6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25V12m-19.5 0h19.5m-19.5 0A2.25 2.25 0 004.5 14.25h15A2.25 2.25 0 0021.75 12m-19.5 0A2.25 2.25 0 004.5 9.75h15a2.25 2.25 0 012.25 2.25" />
  </svg>
);

const CreditCardIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const UserCircleIcon = () => (
  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

const NAV_LINKS = [
  { href: '/',         label: 'Dashboard',  icon: DashboardIcon },
  { href: '/book',     label: 'Book Class', icon: CalendarIcon },
  { href: '/bookings',  label: 'My Classes', icon: TicketIcon },
  { href: '/credits',   label: 'Credits',    icon: CreditCardIcon },
];

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
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-bold tracking-tight text-[#4e2b22] hover:text-[#6b3d32] transition-colors"
            >
              <img src="/logo.png" alt="Pilateq" className="h-8 w-auto" />
              Pilateq
            </Link>

            {/* Mobile hamburger — portal handles the panel */}
            <UserMobileNav />

            <div className="hidden sm:flex items-center gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] transition-all flex items-center gap-2"
                >
                  <span className="text-[#8b6b5c]"><Icon /></span>
                  <span className="text-[#4e2b22]">{label}</span>
                </Link>
              ))}
            </div>
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
