'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';

interface Stats {
  todayRevenue: number;
  totalClients: number;
  activeServices: number;
}

interface Visit {
  id: string;
  created_at: string;
  client: {
    name: string;
  };
  total_amount: number;
  payment_method: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { bar: salon } = useBar();
  const PERIODS = [
    { value: 'today',      label: 'Today' },
    { value: 'week',       label: 'This Week' },
    { value: 'month',      label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom',     label: 'Custom' },
  ];

  const [stats, setStats] = useState<Stats>({
    todayRevenue: 0,
    totalClients: 0,
    activeServices: 0,
  });
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodRevenue, setPeriodRevenue] = useState(0);
  const [periodExpenses, setPeriodExpenses] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => { loadStaticData(); }, []);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) loadPeriodData();
  }, [period, fromDate, toDate]);

  const buildDateParams = () => {
    if (period === 'custom') {
      const p = new URLSearchParams();
      if (fromDate) p.set('from_date', fromDate);
      if (toDate) p.set('to_date', toDate);
      return p;
    }
    return new URLSearchParams({ date: period });
  };

  const loadPeriodData = async () => {
    setPeriodLoading(true);
    try {
      const dateParams = buildDateParams();
      const revParams = new URLSearchParams(dateParams);
      revParams.set('paginated', 'true');
      revParams.set('pageSize', '1');

      const expQs = period === 'custom'
        ? `period=custom&from_date=${fromDate}&to_date=${toDate}`
        : `period=${period}`;
      const discQs = period === 'custom'
        ? `from_date=${fromDate}&to_date=${toDate}`
        : `period=${period}`;

      const [revRes, expRes, discRes, visitsRes] = await Promise.all([
        fetch(`/api/visits?${revParams}`),
        fetch(`/api/expenses?${expQs}`),
        fetch(`/api/dashboard/discounts?${discQs}`),
        fetch(`/api/visits?${dateParams}&limit=5`),
      ]);

      if (revRes.ok)    { const d = await revRes.json();    setPeriodRevenue(d.summary?.totalSales || 0); }
      if (expRes.ok)    { const d = await expRes.json();    setPeriodExpenses(d.summary?.total || 0); }
      if (discRes.ok)   { const d = await discRes.json();   setTotalDiscounts(d.totalDiscountAmount || 0); }
      if (visitsRes.ok) { setRecentVisits(await visitsRes.json()); }
    } catch (error) {
      console.error('Error loading period data:', error);
    } finally {
      setPeriodLoading(false);
    }
  };

  const loadStaticData = async () => {
    try {
      const [statsRes, invRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/inventory/items'),
      ]);
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d); }
      if (invRes.ok)   { const d = await invRes.json();   setLowStockCount(d.summary?.lowStockCount || 0); }
    } catch (error) {
      console.error('Error loading static data:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodLabel = PERIODS.find(p => p.value === period)?.label || 'Today';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const cardFontSize = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs < 10_000)     return 'text-xl xl:text-2xl';
    if (abs < 1_000_000)  return 'text-lg xl:text-xl';
    if (abs < 10_000_000) return 'text-base xl:text-lg';
    return 'text-sm xl:text-base';
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with User Info */}
      <SalonHeader title="Dashboard">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden lg:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <Link href="/pos" className="btn-primary text-xs md:text-sm px-3 md:px-4">
            Open POS
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Period Selector */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Showing data for</label>
              <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                {PERIODS.map(p => {
                  const active = period === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      style={active ? { backgroundColor: salon?.theme_primary_color || '#E31C23', color: '#fff' } : {}}
                      className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                        active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date" value={fromDate} max={toDate || undefined}
                    onChange={e => setFromDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date" value={toDate} min={fromDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setToDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{periodLabel} Revenue</p>
                <p className={`${cardFontSize(periodRevenue)} font-bold text-gray-900 leading-tight`}>
                  {periodLoading ? '...' : formatCurrency(periodRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Clients</p>
                <p className="text-lg xl:text-2xl font-bold text-gray-900 leading-tight">
                  {loading ? '...' : stats.totalClients}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Active Services</p>
                <p className="text-lg xl:text-2xl font-bold text-gray-900 leading-tight">
                  {loading ? '...' : stats.activeServices}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Profit / Expenses / Inventory / Discounts Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Net Profit */}
          <div className="stat-card border-l-4 border-green-500">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Net Profit</p>
                <p className={`${cardFontSize(periodRevenue - periodExpenses)} font-bold leading-tight ${periodRevenue - periodExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodLoading ? '...' : formatCurrency(periodRevenue - periodExpenses)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Revenue − Expenses</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Today's Expenses */}
          <Link href="/expenses" className="stat-card border-l-4 border-red-400 block hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Expenses</p>
                <p className={`${cardFontSize(periodExpenses)} font-bold text-gray-900 leading-tight`}>
                  {periodLoading ? '...' : formatCurrency(periodExpenses)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Tap to view &amp; manage</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Low Stock */}
          <Link href="/inventory" className="stat-card border-l-4 border-orange-400 block hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Low Stock Alerts</p>
                <p className={`text-lg xl:text-2xl font-bold leading-tight ${lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {loading ? '...' : lowStockCount}
                </p>
                <p className="text-xs text-gray-400 mt-1 truncate">{lowStockCount > 0 ? 'Items need restocking' : 'All stock OK'}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                <svg className={`w-6 h-6 ${lowStockCount > 0 ? 'text-orange-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Total Discounts */}
          <div className="stat-card border-l-4 border-yellow-400">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Discounts Given</p>
                <p className={`${cardFontSize(totalDiscounts)} font-bold text-yellow-600 leading-tight`}>
                  {periodLoading ? '...' : formatCurrency(totalDiscounts)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0 ml-2">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Visits */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">{periodLabel} Visits</h2>
            </div>
            <div className="mt-6">
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : recentVisits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No visits for {periodLabel.toLowerCase()}</p>
                  <Link href="/pos" className="text-brand-primary hover:underline mt-2 inline-block">
                    Create first visit
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        {visit.client?.name
                          ? <p className="font-medium text-gray-900">{visit.client.name}</p>
                          : <p className="font-medium text-gray-400 italic">Walk-in</p>
                        }
                        <p className="text-sm text-gray-600">{formatTime(visit.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(visit.total_amount)}</p>
                        <p className="text-xs text-gray-600 capitalize">{visit.payment_method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Quick Actions</h2>
            </div>
            <div className="mt-6 space-y-3">
              <Link href="/pos" className="block p-4 bg-brand-primary/5 hover:bg-brand-primary/10 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">New Transaction</p>
                    <p className="text-sm text-gray-600">Process a sale in POS</p>
                  </div>
                </div>
              </Link>

              <Link href="/clients" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Manage Clients</p>
                    <p className="text-sm text-gray-600">View and edit clients</p>
                  </div>
                </div>
              </Link>

              <Link href="/menu" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.952-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Manage Services</p>
                    <p className="text-sm text-gray-600">Add and edit services</p>
                  </div>
                </div>
              </Link>

              <Link href="/sales" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Sales & Transactions</p>
                    <p className="text-sm text-gray-600">View all transactions</p>
                  </div>
                </div>
              </Link>

              <Link href="/reports" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Reports & Analytics</p>
                    <p className="text-sm text-gray-600">Revenue trends, top services & clients</p>
                  </div>
                </div>
              </Link>

              <Link href="/expenses" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Expenses</p>
                    <p className="text-sm text-gray-600">Track costs &amp; calculate profit</p>
                  </div>
                </div>
              </Link>

              <Link href="/inventory" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Inventory</p>
                    <p className="text-sm text-gray-600">Stock items, groups &amp; movements</p>
                  </div>
                </div>
              </Link>

              {(user?.role === 'owner' || user?.role === 'admin') && (
                <Link href="/users" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">System Users</p>
                      <p className="text-sm text-gray-600">Manage login accounts &amp; roles</p>
                    </div>
                  </div>
                </Link>
              )}

              <Link href="/staff" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Bar Staff</p>
                    <p className="text-sm text-gray-600">Bartenders, servers &amp; employees</p>
                  </div>
                </div>
              </Link>

              {(user?.role === 'owner' || user?.role === 'admin') && (
                <Link href="/settings" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Settings</p>
                      <p className="text-sm text-gray-600">Bar info, branding &amp; settings</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
