import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { CalendarDays, Users, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin' && session.user.role !== 'instructor') {
    redirect('/');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your studio operations and key metrics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Today's Classes</p>
              <p className="text-2xl font-bold text-[#4e2b22]">3</p>
            </div>
            <CalendarDays className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Active Students</p>
              <p className="text-2xl font-bold text-[#4e2b22]">47</p>
            </div>
            <Users className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Credits Sold</p>
              <p className="text-2xl font-bold text-[#4e2b22]">156</p>
            </div>
            <CreditCard className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Revenue</p>
              <p className="text-2xl font-bold text-[#4e2b22]">€2,847</p>
            </div>
            <TrendingUp className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
        <h2 className="text-lg font-semibold text-[#4e2b22] mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/classes"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Manage Classes</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Schedule and manage class sessions</p>
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Class Templates</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Create and edit class templates</p>
          </Link>
          <Link
            href="/admin/credits"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CreditCard className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Credit Packages</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Manage credit packages and pricing</p>
          </Link>
          <Link
            href="/admin/payments"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <TrendingUp className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Payments</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">View payment history and status</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
        <h2 className="text-lg font-semibold text-[#4e2b22] mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-white/60">
            <div className="size-2 rounded-full bg-[#4a7c4a]"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#4e2b22]">New booking for Morning Mat Class</p>
              <p className="text-xs text-[#8b6b5c]">2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-lg bg-white/60">
            <div className="size-2 rounded-full bg-[#4a7c4a]"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#4e2b22]">Credit package purchased: 10 Class Pass</p>
              <p className="text-xs text-[#8b6b5c]">15 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-lg bg-white/60">
            <div className="size-2 rounded-full bg-[#c45c4a]"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#4e2b22]">Booking cancelled for Evening Reformer</p>
              <p className="text-xs text-[#8b6b5c]">1 hour ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
