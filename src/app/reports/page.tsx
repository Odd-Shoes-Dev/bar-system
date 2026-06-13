'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';

const PERIODS = [
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3months',    label: 'Last 3 Months' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

const PAY_COLORS: Record<string, string> = {
  cash:             '#22c55e',
  mtn_mobile_money: '#f59e0b',
  airtel_money:     '#ef4444',
  card:             '#6366f1',
  unknown:          '#9ca3af',
};

const PAY_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN MoMo',
  airtel_money:     'Airtel Money',
  card:             'Card',
};

interface Summary {
  totalRevenue: number;
  totalVisits: number;
  avgOrderValue: number;
  uniqueClients: number;
}

interface DayData    { date: string; revenue: number; visits: number }
interface PayData    { method: string; amount: number; count: number }
interface ServiceRow { service_id: string; name: string; category: string; revenue: number; count: number }
interface ClientRow  { client_id: string; name: string; phone: string; total_spent: number; visits: number }

interface ExpSummary {
  total: number;
  revenue: number;
  netProfit: number;
  byCategory: { category: string; total: number }[];
  byPaymentMethod: { method: string; total: number }[];
}
interface ExpenseRow { id: string; category: string; amount: number; description: string; expense_date: string; payment_method: string; }
interface ClientSearch { id: string; name: string; phone: string; email?: string; total_visits: number; total_spent: number; }
interface ClientVisit {
  id: string; created_at: string; total_amount: number; payment_method: string; receipt_number: string; points_earned: number;
  visit_services: { id: string; unit_price: number; quantity: number; service: { name: string; category: string } }[];
}

type ReportTab = 'overview' | 'expenses' | 'clients';

export default function ReportsPage() {
  const router  = useRouter();
  const { user } = useUser();
  const { bar: salon } = useBar();
  const brandColor = salon?.theme_primary_color || '#6366f1';

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary]                 = useState<Summary | null>(null);
  const [revenueByDay, setRevenueByDay]       = useState<DayData[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PayData[]>([]);
  const [topServices, setTopServices]         = useState<ServiceRow[]>([]);
  const [topClients, setTopClients]           = useState<ClientRow[]>([]);

  // ── Expenses tab ──────────────────────────────────────────────────
  const [expPeriod, setExpPeriod]       = useState('month');
  const [expFromDate, setExpFromDate]   = useState('');
  const [expToDate, setExpToDate]       = useState('');
  const [expLoading, setExpLoading]     = useState(false);
  const [expSummary, setExpSummary]     = useState<ExpSummary | null>(null);
  const [expRows, setExpRows]           = useState<ExpenseRow[]>([]);

  // ── Client Ledger tab ─────────────────────────────────────────────
  const [clientQuery, setClientQuery]         = useState('');
  const [clientResults, setClientResults]     = useState<ClientSearch[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selClient, setSelClient]             = useState<ClientSearch | null>(null);
  const [clientVisits, setClientVisits]       = useState<ClientVisit[]>([]);
  const [clientVisitsLoading, setClientVisitsLoading] = useState(false);


  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (period === 'custom' && fromDate && toDate) {
        qs.set('from_date', fromDate);
        qs.set('to_date', toDate);
      }
      const res = await fetch(`/api/reports?${qs}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSummary(data.summary);
      setRevenueByDay(data.revenueByDay);
      setPaymentBreakdown(data.paymentBreakdown);
      setTopServices(data.topServices);
      setTopClients(data.topClients);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const qs = new URLSearchParams({ period: expPeriod });
      if (expPeriod === 'custom' && expFromDate && expToDate) {
        qs.set('from_date', expFromDate); qs.set('to_date', expToDate);
      }
      const res = await fetch(`/api/expenses?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setExpSummary(data.summary || null);
        setExpRows(data.expenses || []);
      }
    } finally { setExpLoading(false); }
  }, [expPeriod, expFromDate, expToDate]);


  const loadClientVisits = useCallback(async (clientId: string) => {
    setClientVisitsLoading(true);
    try {
      const res = await fetch(`/api/visits?client_id=${clientId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setClientVisits(Array.isArray(data) ? data : (data.visits || []));
      }
    } finally { setClientVisitsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'expenses' && (expPeriod !== 'custom' || (expFromDate && expToDate))) {
      loadExpenses();
    }
  }, [activeTab, expPeriod, expFromDate, expToDate, loadExpenses]);

  useEffect(() => {
    if (activeTab !== 'clients') return;
    setClientSearching(true);
    const delay = clientQuery.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ paginated: 'true', pageSize: '30' });
        if (clientQuery.trim()) qs.set('search', clientQuery.trim());
        const res = await fetch(`/api/clients?${qs}`);
        if (res.ok) {
          const data = await res.json();
          setClientResults(data.data || data.clients || []);
        }
      } finally { setClientSearching(false); }
    }, delay);
    return () => clearTimeout(timer);
  }, [clientQuery, activeTab]);

  const exportCSV = () => {
    if (!summary) return;
    const rows: string[][] = [];

    rows.push(['SUMMARY']);
    rows.push(['Total Revenue', String(summary.totalRevenue)]);
    rows.push(['Total Transactions', String(summary.totalVisits)]);
    rows.push(['Avg Order Value', String(Math.round(summary.avgOrderValue))]);
    rows.push(['Unique Clients', String(summary.uniqueClients)]);
    rows.push([]);

    rows.push(['REVENUE BY DAY', '', '']);
    rows.push(['Date', 'Revenue', 'Visits']);
    revenueByDay.forEach(d => rows.push([d.date, String(d.revenue), String(d.visits)]));
    rows.push([]);

    rows.push(['TOP ITEMS', '', '']);
    rows.push(['Item', 'Revenue', 'Count']);
    topServices.forEach(s => rows.push([s.name, String(s.revenue), String(s.count)]));
    rows.push([]);

    rows.push(['TOP CLIENTS', '', '', '']);
    rows.push(['Name', 'Phone', 'Visits', 'Total Spent']);
    topClients.forEach(c => rows.push([
      c.client_id === '__walkin__' ? 'Walk-in' : (c.name || '—'),
      c.phone,
      String(c.visits),
      String(c.total_spent),
    ]));
    rows.push([]);

    rows.push(['PAYMENT METHODS', '', '']);
    rows.push(['Method', 'Amount', 'Count']);
    paymentBreakdown.forEach(p => rows.push([p.method, String(p.amount), String(p.count)]));

    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!summary || !reportRef.current) return;
    setExporting(true);
    setExportOpen(false);
    try {
      const { default: jsPDF } = await import('jspdf');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // ── Header: logo + salon info ──────────────────────────────────
      const brandColor = salon?.theme_primary_color || '#E31C23';
      const r = parseInt(brandColor.slice(1, 3), 16);
      const g = parseInt(brandColor.slice(3, 5), 16);
      const b = parseInt(brandColor.slice(5, 7), 16);

      if (salon?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej();
            img.src = salon.logo_url!;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          const logoData = canvas.toDataURL('image/png');
          const logoH = 16;
          const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
          pdf.addImage(logoData, 'PNG', margin, y, logoW, logoH);
          y += logoH + 4;
        } catch { /* skip logo if blocked */ }
      }

      pdf.setFontSize(18);
      pdf.setTextColor(r, g, b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(salon?.name || 'Bar', margin, y);
      y += 7;

      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont('helvetica', 'normal');
      if (salon?.address) { pdf.text(salon.address, margin, y); y += 5; }
      if (salon?.phone)   { pdf.text(salon.phone, margin, y); y += 5; }
      if (salon?.email)   { pdf.text(salon.email, margin, y); y += 5; }

      const periodLabel = PERIODS.find(p => p.value === period)?.label || period;
      const dateRange = `${fromDate || ''} ${toDate ? '— ' + toDate : ''}`.trim();
      pdf.text(`Report Period: ${periodLabel}${dateRange ? ' (' + dateRange + ')' : ''}`, margin, y); y += 5;
      pdf.text(`Generated: ${new Date().toLocaleString('en-UG')}`, margin, y); y += 8;

      // Divider
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y, pw - margin, y);
      y += 6;

      // ── Summary cards ──────────────────────────────────────────────
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('Summary', margin, y); y += 6;

      const cards = [
        { label: 'Total Revenue',    value: formatCurrency(summary.totalRevenue) },
        { label: 'Transactions',     value: String(summary.totalVisits) },
        { label: 'Avg Order Value',  value: formatCurrency(summary.avgOrderValue) },
        { label: 'Unique Clients',   value: String(summary.uniqueClients) },
      ];
      const cardW = (pw - margin * 2 - 9) / 4;
      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 3);
        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, y, cardW, 16, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(c.label, x + 3, y + 5);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(c.value, x + 3, y + 12);
      });
      y += 22;

      const checkPageBreak = (needed: number) => {
        if (y + needed > ph - margin) { pdf.addPage(); y = margin; }
      };

      const sectionTitle = (title: string) => {
        checkPageBreak(12);
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30);
        pdf.text(title, margin, y); y += 6;
      };

      // ── Revenue chart (bar chart drawn with rects) ─────────────────
      if (revenueByDay.length > 0) {
        sectionTitle('Revenue Over Time');
        const chartH = 40; const chartW = pw - margin * 2;
        const maxRev = Math.max(...revenueByDay.map(d => d.revenue), 1);
        const slotW = Math.max(4, Math.min(12, chartW / revenueByDay.length));
        const barW = slotW * 0.6;
        const gapW = slotW - barW;
        const totalBarsW = revenueByDay.length * slotW;
        const startX = margin + (chartW - totalBarsW) / 2;
        revenueByDay.forEach((d, i) => {
          const barH = Math.max(0.5, (d.revenue / maxRev) * chartH);
          const x = startX + i * slotW + gapW / 2;
          pdf.setFillColor(r, g, b);
          pdf.rect(x, y + chartH - barH, barW, barH, 'F');
        });
        // x-axis baseline
        pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2);
        pdf.line(startX, y + chartH, startX + totalBarsW, y + chartH);
        // x-axis labels (first + last)
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
        if (revenueByDay.length > 0) {
          pdf.text(formatDate(revenueByDay[0].date), startX, y + chartH + 4);
          if (revenueByDay.length > 1) {
            const lastDate = formatDate(revenueByDay[revenueByDay.length - 1].date);
            const lastX = startX + (revenueByDay.length - 1) * slotW + gapW / 2;
            pdf.text(lastDate, lastX, y + chartH + 4);
          }
        }
        y += chartH + 10;
      }

      // ── Payment Methods ────────────────────────────────────────────
      if (paymentBreakdown.length > 0) {
        checkPageBreak(10 + paymentBreakdown.length * 7);
        sectionTitle('Payment Methods');
        const colW = (pw - margin * 2) / 3;
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Method', margin, y);
        pdf.text('Count', margin + colW, y, { align: 'right' });
        pdf.text('Amount', margin + colW * 2, y, { align: 'right' });
        y += 1;
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.3);
        pdf.line(margin, y, pw - margin, y); y += 4;
        const totalAmt = paymentBreakdown.reduce((s, p) => s + Number(p.amount), 0);
        paymentBreakdown.forEach(p => {
          const pct = totalAmt > 0 ? ((Number(p.amount) / totalAmt) * 100).toFixed(0) : '0';
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30);
          pdf.text(`${PAY_LABELS[p.method] || p.method} (${pct}%)`, margin, y);
          pdf.text(String(p.count), margin + colW, y, { align: 'right' });
          pdf.text(formatCurrency(Number(p.amount)), margin + colW * 2, y, { align: 'right' });
          y += 6;
        });
        y += 4;
      }

      // ── Top Items ──────────────────────────────────────────────────
      if (topServices.length > 0) {
        checkPageBreak(10 + Math.min(topServices.length, 6) * 7);
        sectionTitle('Top Items');
        const maxRev = topServices[0].revenue;
        topServices.slice(0, 6).forEach((svc, i) => {
          checkPageBreak(8);
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
          pdf.text(`#${i + 1}`, margin, y);
          pdf.setTextColor(30, 30, 30);
          pdf.text(svc.name, margin + 8, y);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatCurrency(svc.revenue), pw - margin - 18, y, { align: 'right' });
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
          pdf.text(`×${svc.count}`, pw - margin, y, { align: 'right' });
          y += 3;
          // bar
          const barW = ((pw - margin * 2 - 8) * (svc.revenue / maxRev));
          pdf.setFillColor(r, g, b, 0.15);
          pdf.setFillColor(220, 220, 220);
          pdf.rect(margin + 8, y, pw - margin * 2 - 8, 1.5, 'F');
          pdf.setFillColor(r, g, b);
          pdf.rect(margin + 8, y, barW, 1.5, 'F');
          y += 5;
        });
        y += 4;
      }

      // ── Top Clients ────────────────────────────────────────────────
      if (topClients.length > 0) {
        checkPageBreak(14 + topClients.length * 8);
        sectionTitle('Top Clients by Spend');
        const cols = [
          { label: '#',           w: 8,  align: 'left'  as const },
          { label: 'Client',      w: 60, align: 'left'  as const },
          { label: 'Visits',      w: 20, align: 'right' as const },
          { label: 'Total Spent', w: 40, align: 'right' as const },
          { label: 'Avg / Visit', w: 40, align: 'right' as const },
        ];
        // header row
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 100, 100);
        let cx = margin;
        cols.forEach(col => {
          pdf.text(col.label, col.align === 'right' ? cx + col.w : cx, y, { align: col.align });
          cx += col.w;
        });
        y += 1;
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.3);
        pdf.line(margin, y, pw - margin, y); y += 4;

        topClients.forEach((c, i) => {
          checkPageBreak(9);
          const isWalkIn = c.client_id === '__walkin__';
          pdf.setFontSize(8); pdf.setFont('helvetica', isWalkIn ? 'italic' : 'normal');
          pdf.setTextColor(isWalkIn ? 150 : 30, isWalkIn ? 150 : 30, isWalkIn ? 150 : 30);
          cx = margin;
          const rowData = [
            String(i + 1),
            isWalkIn ? 'Walk-in' : (c.name || '—'),
            String(c.visits),
            formatCurrency(c.total_spent),
            formatCurrency(c.total_spent / c.visits),
          ];
          cols.forEach((col, ci) => {
            pdf.text(rowData[ci], col.align === 'right' ? cx + col.w : cx, y, { align: col.align });
            cx += col.w;
          });
          // phone sub-line
          if (!isWalkIn && c.phone) {
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 150, 150);
            pdf.text(c.phone, margin + 8, y + 4);
          }
          y += 8;
          pdf.setDrawColor(240, 240, 240); pdf.setLineWidth(0.2);
          pdf.line(margin, y - 1, pw - margin, y - 1);
        });
      }

      pdf.save(`report_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const maxDayRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Reports & Analytics">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          {!loading && summary && (
            <div className="relative">
              <button
                onClick={() => setExportOpen(o => !o)}
                disabled={exporting}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting…' : 'Export'}
                <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => { exportCSV(); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as CSV
                  </button>
                  <button
                    onClick={exportPDF}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          )}
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </SalonHeader>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'expenses', label: 'Expense Report' },
            { id: 'clients',  label: 'Client Ledger' },
          ] as { id: ReportTab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto p-6">

        {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
        {activeTab === 'overview' && <>

        {/* Period Selector */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Period</label>
              <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                {PERIODS.map(p => {
                  const active = period === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                      className={`px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all ${
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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-pulse mb-6">
            {[1,2,3,4].map(i => <div key={i} className="card h-24 bg-gray-100" />)}
          </div>
        ) : (
          <div ref={reportRef}>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
              <div className="card border-l-4 border-brand-primary">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
              </div>
              <div className="card border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary?.totalVisits || 0}</p>
              </div>
              <div className="card border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Avg. Order Value</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.avgOrderValue || 0)}</p>
              </div>
              <div className="card border-l-4 border-purple-500">
                <p className="text-sm text-gray-600">Unique Clients</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary?.uniqueClients || 0}</p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="card mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
              {revenueByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={36}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                      labelFormatter={(label: any) => formatDate(String(label ?? ''))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill={brandColor} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Payment Breakdown */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
                {paymentBreakdown.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-auto flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={false}
                          labelLine={false}
                        >
                          {paymentBreakdown.map(entry => (
                            <Cell key={entry.method} fill={PAY_COLORS[entry.method] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value ?? 0))}
                          contentStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1">
                      {paymentBreakdown.map(p => {
                        const total = paymentBreakdown.reduce((s, x) => s + Number(x.amount), 0);
                        const pct = total > 0 ? ((Number(p.amount) / total) * 100).toFixed(0) : '0';
                        return (
                        <div key={p.method} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PAY_COLORS[p.method] || '#9ca3af' }}
                          />
                          <span className="text-gray-700 truncate">{PAY_LABELS[p.method] || p.method}</span>
                          <span className="ml-auto font-medium text-gray-900 shrink-0">{p.count} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Items */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Top Items</h2>
                {topServices.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="space-y-3">
                    {topServices.slice(0, 6).map((svc, i) => (
                      <div key={svc.service_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-800 truncate max-w-[55%]">
                            <span className="text-gray-400 mr-1.5">#{i + 1}</span>
                            {svc.name}
                          </span>
                          <div className="text-right shrink-0">
                            <span className="font-medium text-gray-900">{formatCurrency(svc.revenue)}</span>
                            <span className="text-gray-400 ml-2 text-xs">×{svc.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded-full"
                            style={{ width: `${(svc.revenue / topServices[0].revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Clients */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Top Clients by Spend</h2>
              {topClients.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Visits</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                        <th className="hidden sm:table-cell text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Avg/Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topClients.map((c, i) => {
                        const isWalkIn = c.client_id === '__walkin__';
                        return (
                          <tr key={c.client_id} className="hover:bg-gray-50">
                            <td className="py-3 px-3 text-sm text-gray-400">{i + 1}</td>
                            <td className="py-3 px-3 max-w-[120px] sm:max-w-none">
                              {isWalkIn ? (
                                <p className="font-medium text-gray-400 text-sm italic">Walk-in</p>
                              ) : (
                                <>
                                  <p className="font-medium text-gray-900 text-sm truncate">{c.name || '—'}</p>
                                  {c.phone && <p className="text-xs text-gray-400 truncate">{c.phone}</p>}
                                </>
                              )}
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-700 text-right">{c.visits}</td>
                            <td className="py-3 px-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{formatCurrency(c.total_spent)}</td>
                            <td className="hidden sm:table-cell py-3 px-3 text-sm text-gray-600 text-right whitespace-nowrap">{formatCurrency(c.total_spent / c.visits)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* end overview */}
        </>}

        {/* ── EXPENSES TAB ─────────────────────────────────────────── */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* Period */}
            <div className="card">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Period</label>
                  <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                    {PERIODS.map(p => {
                      const active = expPeriod === p.value;
                      return (
                        <button key={p.value} onClick={() => setExpPeriod(p.value)}
                          style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}
                        >{p.label}</button>
                      );
                    })}
                  </div>
                </div>
                {expPeriod === 'custom' && (
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                      <input type="date" value={expFromDate} onChange={e => setExpFromDate(e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                      <input type="date" value={expToDate} max={new Date().toISOString().split('T')[0]} onChange={e => setExpToDate(e.target.value)} className="input" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {expLoading ? (
              <div className="grid grid-cols-3 gap-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="card h-20 bg-gray-100" />)}</div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card border-l-4 border-red-400">
                    <p className="text-sm text-gray-500">Total Expenses</p>
                    <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(expSummary?.total || 0)}</p>
                  </div>
                  <div className="card border-l-4 border-green-400">
                    <p className="text-sm text-gray-500">Revenue</p>
                    <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(expSummary?.revenue || 0)}</p>
                  </div>
                  <div className={`card border-l-4 ${(expSummary?.netProfit || 0) >= 0 ? 'border-brand-primary' : 'border-orange-400'}`}>
                    <p className="text-sm text-gray-500">Net Profit</p>
                    <p className={`text-xl font-bold mt-1 ${(expSummary?.netProfit || 0) >= 0 ? 'text-gray-900' : 'text-orange-600'}`}>{formatCurrency(expSummary?.netProfit || 0)}</p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* By Category */}
                  <div className="card">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
                    {(expSummary?.byCategory || []).length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">No expenses for this period</div>
                    ) : (
                      <div className="space-y-3">
                        {(expSummary?.byCategory || []).sort((a, b) => b.total - a.total).map(cat => (
                          <div key={cat.category}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-700 font-medium">{cat.category}</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-red-400"
                                style={{ width: `${(cat.total / (expSummary?.total || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* By Payment Method */}
                  <div className="card">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">By Payment Method</h2>
                    {(expSummary?.byPaymentMethod || []).length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">No data</div>
                    ) : (
                      <div className="space-y-3">
                        {(expSummary?.byPaymentMethod || []).map(pm => (
                          <div key={pm.method} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PAY_COLORS[pm.method] || '#9ca3af' }} />
                              <span className="text-sm text-gray-700">{PAY_LABELS[pm.method] || pm.method}</span>
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{formatCurrency(pm.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense rows */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Expense Transactions <span className="text-gray-400 font-normal text-sm">({expRows.length})</span></h2>
                  </div>
                  {expRows.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No expenses recorded</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Paid From</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {expRows.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{e.expense_date}</td>
                              <td className="py-2.5 px-4 text-gray-700 font-medium">{e.category}</td>
                              <td className="py-2.5 px-4 text-gray-500">{e.description || '—'}</td>
                              <td className="py-2.5 px-4">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PAY_LABELS[e.payment_method] || e.payment_method}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CLIENT LEDGER TAB ────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Client</label>
              <div className="relative">
                <input
                  value={clientQuery}
                  onChange={e => { setClientQuery(e.target.value); setSelClient(null); setClientVisits([]); }}
                  placeholder="Name or phone number…"
                  className="input w-full pr-10"
                />
                {clientSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Searching…</span>
                )}
              </div>
            </div>

            {/* Client list — always visible when no client selected */}
            {!selClient && (
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Clients <span className="text-gray-400 font-normal text-sm">({clientResults.length})</span></h2>
                  {clientSearching && <span className="text-xs text-gray-400">Loading…</span>}
                </div>
                {clientResults.length === 0 && !clientSearching ? (
                  <div className="py-10 text-center text-gray-400 text-sm">No clients found</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelClient(c); loadClientVisits(c.id); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{c.total_visits} visits</p>
                          <p className="text-xs font-medium text-gray-700">{formatCurrency(Number(c.total_spent))}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selClient && (
              <>
                <button
                  onClick={() => { setSelClient(null); setClientVisits([]); }}
                  className="text-sm text-brand-primary font-medium flex items-center gap-1 hover:underline"
                >
                  ← Back to clients
                </button>
                {/* Client Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="card border-l-4 border-brand-primary">
                    <p className="text-xs text-gray-500">Total Visits</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{selClient.total_visits}</p>
                  </div>
                  <div className="card border-l-4 border-green-400">
                    <p className="text-xs text-gray-500">Total Spent</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(Number(selClient.total_spent))}</p>
                  </div>
                  <div className="card border-l-4 border-blue-400">
                    <p className="text-xs text-gray-500">Avg / Visit</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(Number(selClient.total_visits) > 0 ? Number(selClient.total_spent) / Number(selClient.total_visits) : 0)}</p>
                  </div>
                  <div className="card border-l-4 border-purple-400">
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{selClient.phone}</p>
                  </div>
                </div>

                {/* Visit History */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Visit History <span className="text-gray-400 font-normal text-sm">({clientVisits.length})</span></h2>
                  </div>
                  {clientVisitsLoading ? (
                    <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
                  ) : clientVisits.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No visits recorded yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Services</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Points</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {clientVisits.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                {new Date(v.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">{v.receipt_number}</td>
                              <td className="py-2.5 px-4 text-gray-700">
                                {(v.visit_services || []).map(vs => vs.service?.name).filter(Boolean).join(', ') || '—'}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PAY_LABELS[v.payment_method] || v.payment_method}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right text-purple-600 font-medium">+{v.points_earned || 0}</td>
                              <td className="py-2.5 px-4 text-right font-semibold text-gray-900">{formatCurrency(v.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}


          </div>
        )}


      </div>
    </div>
  );
}
