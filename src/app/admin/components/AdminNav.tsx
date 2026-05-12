'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const TemplateIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
  </svg>
);

const CoinsIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const SyncIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: CalendarIcon,
    items: [
      { href: '/admin/classes',    label: 'Classes',   icon: CalendarIcon,  desc: 'Manage classes & sessions' },
      { href: '/admin/templates',  label: 'Templates', icon: TemplateIcon,  desc: 'Edit class templates' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: PaymentIcon,
    items: [
      { href: '/admin/credits',       label: 'Packages',      icon: CoinsIcon,   desc: 'Credit packages & pricing' },
      { href: '/admin/user-credits',  label: 'User Credits',  icon: UsersIcon,   desc: 'Balances & transactions' },
      { href: '/admin/payments',      label: 'Payments',      icon: PaymentIcon, desc: 'Invoices & payment history' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SyncIcon,
    items: [
      { href: '/admin/calendar-sync', label: 'Google Calendar', icon: SyncIcon, desc: 'Calendar synchronisation' },
    ],
  },
];

// ── Dropdown component ────────────────────────────────────────────────────────

function NavDropdown({
  group,
}: {
  group: (typeof NAV_GROUPS)[number];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = group.items.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'bg-[#4e2b22]/10 text-[#4e2b22]'
            : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]'
        }`}
      >
        <span className={isActive ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>
          <group.icon />
        </span>
        {group.label}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-[#ede8e5] bg-white shadow-lg shadow-[#4e2b22]/10 z-50 overflow-hidden">
          <div className="p-1.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all ${
                    active
                      ? 'bg-[#4e2b22]/10 text-[#4e2b22]'
                      : 'text-[#6b3d32] hover:bg-[#ede8e5]/50 hover:text-[#4e2b22]'
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${active ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}`}>
                    <item.icon />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight">{item.label}</p>
                    <p className="text-xs text-[#8b6b5c] mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────

export function AdminNav() {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin';

  return (
    <div className="hidden sm:flex items-center gap-1 ml-4">
      {/* Dashboard — direct link */}
      <Link
        href="/admin"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          isDashboard
            ? 'bg-[#4e2b22]/10 text-[#4e2b22]'
            : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]'
        }`}
      >
        <span className={isDashboard ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>
          <DashboardIcon />
        </span>
        Dashboard
      </Link>

      {/* Grouped dropdowns */}
      {NAV_GROUPS.map((group) => (
        <NavDropdown key={group.id} group={group} />
      ))}
    </div>
  );
}
