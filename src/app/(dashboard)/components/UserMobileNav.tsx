'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MenuIcon, XIcon } from 'lucide-react';

const NAV_LINKS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/book',
    label: 'Book Class',
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/bookings',
    label: 'My Classes',
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M2.25 12V6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25V12m-19.5 0h19.5m-19.5 0A2.25 2.25 0 004.5 14.25h15A2.25 2.25 0 0021.75 12m-19.5 0A2.25 2.25 0 004.5 9.75h15a2.25 2.25 0 012.25 2.25" />
      </svg>
    ),
  },
  {
    href: '/credits',
    label: 'Credits',
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
];

function MobileMenu({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div className="fixed inset-0 top-[57px] z-40 flex flex-col bg-[#faf9f7] overflow-y-auto">
      <nav className="flex flex-col gap-1 p-4">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-[#4e2b22]/10 text-[#4e2b22] font-semibold'
                  : 'text-[#6b3d32] hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]'
              }`}
            >
              <span className={active ? 'text-[#4e2b22]' : 'text-[#8b6b5c]'}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function UserMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="sm:hidden flex size-12 items-center justify-center rounded-lg border border-[#ede8e5] text-[#6b3d32] transition-all hover:bg-[#ede8e5]/60"
      >
        {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>

      {open && createPortal(
        <MobileMenu onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}
