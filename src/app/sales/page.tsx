'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SalonHeader } from '@/components/SalonBranding';
import { TransactionSummaryModal, TransactionSummaryData } from '@/components/TransactionSummaryModal';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Visit {
  id: string;
  receipt_number: string;
  total_amount: number;
  payment_method: string;
  points_earned: number;
  created_at: string;
  client: {
    name: string;
    phone: string;
  };
  visit_services: Array<{
    quantity: number;
    unit_price: number;
    service: {
      name: string;
    };
  }>;
}

export default function SalesPage() {
  const { user } = useUser();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalSales: 0,
    transactionCount: 0,
    avgOrderValue: 0,
    pointsAwarded: 0,
    cashSales: 0,
    mtnSales: 0,
    airtelSales: 0,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionSummaryData | null>(null);

  useEffect(() => {
    setPage(1);
  }, [dateFilter, paymentFilter, customFromDate, customToDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVisits(page, searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [page, searchQuery, dateFilter, paymentFilter, customFromDate, customToDate]);

  const loadVisits = async (currentPage = page, query = searchQuery) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        paginated: 'true',
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      if (dateFilter === 'custom') {
        if (customFromDate) params.set('from_date', customFromDate);
        if (customToDate) params.set('to_date', customToDate);
      } else {
        params.set('date', dateFilter);
      }

      if (paymentFilter !== 'all') params.set('payment_method', paymentFilter);
      if (query.trim()) params.set('search', query.trim());

      const response = await fetch(`/api/visits?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        setVisits(payload.data || []);
        setPagination(payload.pagination || { page: currentPage, pageSize, total: 0, totalPages: 1 });
        setSummary(payload.summary || {
          totalSales: 0,
          transactionCount: 0,
          avgOrderValue: 0,
          pointsAwarded: 0,
          cashSales: 0,
          mtnSales: 0,
          airtelSales: 0,
        });
      }
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const getVisiblePages = () => {
    const pages: number[] = [];
    const total = pagination.totalPages;
    const current = pagination.page;

    if (total <= 7) {
      for (let i = 1; i <= total; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i += 1) pages.push(i);
    pages.push(total);

    return Array.from(new Set(pages));
  };

  const exportToCSV = () => {
    // Create CSV header
    const headers = ['Receipt', 'Date & Time', 'Client Name', 'Client Phone', 'Services', 'Payment Method', 'Amount', 'Points'];
    
    // Create CSV rows
    const rows = visits.map(visit => [
      visit.receipt_number,
      formatDateTime(visit.created_at),
      visit.client.name,
      visit.client.phone,
      visit.visit_services?.map(vs => `${vs.quantity}x ${vs.service?.name || 'Unknown'}`).join('; ') || '',
      visit.payment_method === 'mtn_mobile_money' ? 'MTN Mobile Money' : visit.payment_method === 'airtel_money' ? 'Airtel Money' : 'Cash',
      visit.total_amount,
      visit.points_earned
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_${dateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVoidTransaction = async (visit: Visit) => {
    const confirmed = window.confirm(`Void transaction ${visit.receipt_number}?\n\nThis will permanently void the receipt and reverse the client's loyalty points and totals. This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/visits/${visit.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to void transaction');
      }

      setPage(1);
      loadVisits(1, searchQuery);
    } catch (error: any) {
      alert(error.message || 'Failed to void transaction');
    }
  };

  const openTransactionModal = (visit: Visit) => {
    setSelectedTransaction({
      receiptNumber: visit.receipt_number,
      clientName: visit.client?.name || 'Unknown Client',
      clientPhone: visit.client?.phone || '',
      services: (visit.visit_services || []).map((item) => ({
        name: item.service?.name || 'Unknown Service',
        quantity: item.quantity || 1,
        unitPrice: Number(item.unit_price || 0),
      })),
      total: Number(visit.total_amount || 0),
      pointsEarned: Number(visit.points_earned || 0),
      paymentMethod: visit.payment_method,
      date: visit.created_at,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Sales & Transactions">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            Dashboard
          </Link>
          <Link href="/pos" className="btn-primary text-sm px-3 py-2">
            New Sale
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-4 md:p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-600 mb-1">Total Sales</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Transactions</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.transactionCount}</p>
          </div>
          <div className="card border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(summary.avgOrderValue)}</p>
          </div>
          <div className="card border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">Points Awarded</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {summary.pointsAwarded}
            </p>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Cash Payments</p>
            <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatCurrency(summary.cashSales)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">MTN Mobile Money</p>
            <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatCurrency(summary.mtnSales)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Airtel Money</p>
            <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatCurrency(summary.airtelSales)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by client name, phone, or receipt..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              />
            </div>
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {dateFilter === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={customFromDate}
                    max={customToDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={customToDate}
                    min={customFromDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="mtn_mobile_money">MTN Money</option>
                <option value="airtel_money">Airtel Money</option>
              </select>
            </div>
            <div>
              <button
                onClick={exportToCSV}
                disabled={visits.length === 0}
                className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Services</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openTransactionModal(visit)}
                    >
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm">{visit.receipt_number}</span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {formatDateTime(visit.created_at)}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{visit.client.name}</p>
                          <p className="text-sm text-gray-600">{visit.client.phone}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {visit.visit_services?.map((vs, idx) => (
                          <div key={idx}>
                            {vs.quantity}x {vs.service?.name || 'Unknown'}
                          </div>
                        ))}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          visit.payment_method === 'cash' 
                            ? 'bg-green-100 text-green-800'
                            : visit.payment_method === 'mtn_mobile_money'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {visit.payment_method === 'mtn_mobile_money' ? 'MTN_MOBILE_MONEY' : visit.payment_method === 'airtel_money' ? 'AIRTEL_MONEY' : visit.payment_method.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(visit.total_amount)}
                      </td>
                      <td className="py-4 px-4 text-right text-brand-primary font-medium">
                        +{visit.points_earned}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {(user?.role === 'owner' || user?.role === 'admin') ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleVoidTransaction(visit);
                            }}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Void
                          </button>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200 px-4 pb-4">
              <p className="text-sm text-gray-600">
                Showing {rangeStart}-{rangeEnd} of {pagination.total} transactions
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                {getVisiblePages().map((pageNumber, index, arr) => {
                  const previous = index > 0 ? arr[index - 1] : null;
                  const shouldShowEllipsis = previous !== null && pageNumber - previous > 1;

                  return (
                    <span key={`sales-page-${pageNumber}`} className="flex items-center gap-2">
                      {shouldShowEllipsis && <span className="text-gray-400">...</span>}
                      <button
                        onClick={() => setPage(pageNumber)}
                        className={`w-9 h-9 text-sm rounded-lg border ${
                          pagination.page === pageNumber
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}

                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTransaction && (
        <TransactionSummaryModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}
