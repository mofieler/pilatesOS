import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { CalendarDays, Users, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { and, eq, gte, lt, isNull, sql, desc } from 'drizzle-orm';
import {
  classSessions,
  users,
  creditPurchases,
  bookings,
  classTemplates,
} from '@/db/schema';
import { format } from 'date-fns';

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's classes count
  const [todayClassesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classSessions)
    .where(
      and(
        gte(classSessions.startTime, today),
        lt(classSessions.startTime, tomorrow)
      )
    );

  // Active students count (users with role 'user' who are not deleted)
  const [activeStudentsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.role, 'user'),
        isNull(users.deletedAt)
      )
    );

  // Credits sold - sum of credits from all purchases
  const [creditsSoldResult] = await db
    .select({ 
      total: sql<number | null>`sum(${creditPurchases.creditsAmount})::int` 
    })
    .from(creditPurchases);

  // Revenue - sum of all credit purchase amounts
  const [revenueResult] = await db
    .select({ 
      total: sql<number | null>`sum(${creditPurchases.priceCents})::int` 
    })
    .from(creditPurchases);

  // Recent bookings with class info
  const recentBookings = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      createdAt: bookings.createdAt,
      className: classTemplates.name,
    })
    .from(bookings)
    .leftJoin(classSessions, eq(bookings.classSessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .orderBy(desc(bookings.createdAt))
    .limit(5);

  // Recent credit purchases
  const recentPurchases = await db
    .select({
      id: creditPurchases.id,
      creditsAmount: creditPurchases.creditsAmount,
      priceCents: creditPurchases.priceCents,
      createdAt: creditPurchases.createdAt,
    })
    .from(creditPurchases)
    .orderBy(desc(creditPurchases.createdAt))
    .limit(5);

  return {
    todayClasses: todayClassesResult?.count ?? 0,
    activeStudents: activeStudentsResult?.count ?? 0,
    creditsSold: creditsSoldResult?.total ?? 0,
    revenue: revenueResult?.total ?? 0,
    recentBookings,
    recentPurchases,
  };
}

export default async function AdminDashboard() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin' && session.user.role !== 'instructor') {
    redirect('/');
  }

  const stats = await getDashboardStats();

  // Combine and sort recent activity
  const recentActivity = [
    ...stats.recentBookings.map(b => ({
      type: b.status === 'cancelled' ? 'cancellation' : 'booking',
      message: b.status === 'cancelled' 
        ? `Booking cancelled for ${b.className || 'Unknown Class'}`
        : `New booking for ${b.className || 'Unknown Class'}`,
      timestamp: b.createdAt,
    })),
    ...stats.recentPurchases.map(p => ({
      type: 'purchase',
      message: `Credit package purchased: ${p.creditsAmount} credits`,
      timestamp: p.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

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
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.todayClasses}</p>
            </div>
            <CalendarDays className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Active Students</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.activeStudents}</p>
            </div>
            <Users className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Credits Sold</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{stats.creditsSold}</p>
            </div>
            <CreditCard className="h-8 w-8 text-[#c4a88a]" />
          </div>
        </div>
        <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b3d32]">Revenue</p>
              <p className="text-2xl font-bold text-[#4e2b22]">{formatPrice(stats.revenue)}</p>
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
            href="/admin/admin/classes"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Manage Classes</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Schedule and manage class sessions</p>
          </Link>
          <Link
            href="/admin/admin/templates"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CalendarDays className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Class Templates</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Create and edit class templates</p>
          </Link>
          <Link
            href="/admin/admin/credits"
            className="rounded-lg border border-[#ede8e5]/60 bg-white/60 p-4 hover:bg-[#faf9f7]/80 transition-all"
          >
            <CreditCard className="h-6 w-6 text-[#4e2b22] mb-2" />
            <h3 className="font-medium text-[#4e2b22]">Credit Packages</h3>
            <p className="text-sm text-[#8b6b5c] mt-1">Manage credit packages and pricing</p>
          </Link>
          <Link
            href="/admin/admin/payments"
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
          {recentActivity.length === 0 ? (
            <p className="text-sm text-[#8b6b5c] py-4">No recent activity</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-white/60">
                <div className={`size-2 rounded-full ${
                  activity.type === 'cancellation' ? 'bg-[#c45c4a]' : 'bg-[#4a7c4a]'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#4e2b22]">{activity.message}</p>
                  <p className="text-xs text-[#8b6b5c]">{formatTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
