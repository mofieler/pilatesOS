import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';

// Heroicons-style SVG icons
const CalendarIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const TemplateIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15H3.75M9 18H3.75M9 9H3.75M15 12h3.75M15 15h3.75M15 18h3.75M15 9h3.75M21 12V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5H12" />
  </svg>
);

const CoinsIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const DashboardIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

const NAV_LINKS = [
  { href: '/admin',           label: 'Dashboard', icon: DashboardIcon },
  { href: '/admin/admin/classes',   label: 'Classes',   icon: CalendarIcon },
  { href: '/admin/admin/templates', label: 'Templates', icon: TemplateIcon },
  { href: '/admin/admin/credits',      label: 'Credits',     icon: CoinsIcon },
  { href: '/admin/admin/user-credits', label: 'User Credits', icon: UsersIcon },
  { href: '/admin/admin/payments',     label: 'Payments',    icon: PaymentIcon },
];

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
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-hidden">
          {/* Brand + nav links */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Pilateq" className="h-8 w-auto" />
            <h1 className="text-xl font-bold text-[#4e2b22]">Pilateq</h1>
            <span className="rounded-full bg-[#4e2b22] px-3 py-1 text-xs font-semibold text-[#faf9f7]">
              Admin
            </span>

            <div className="hidden sm:flex items-center gap-1 ml-4 overflow-x-hidden">
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
