'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { formatCurrency } from '@/lib/utils';
import { useModalEsc } from '@/contexts/EscContext';

const PERIODS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

const PRESET_CATEGORIES = [
  'Rent', 'Salaries', 'Supplies', 'Utilities', 'Equipment',
  'Marketing', 'Transport', 'Maintenance', 'Other',
];

const PAYMENT_METHODS = [
  { value: 'cash',             label: 'Cash',             icon: '💵' },
  { value: 'mtn_mobile_money', label: 'MTN Mobile Money', icon: '📱' },
  { value: 'airtel_money',     label: 'Airtel Money',     icon: '📲' },
  { value: 'other',            label: 'Other',            icon: '💳' },
];

const pmLabel = (v: string) => PAYMENT_METHODS.find(p => p.value === v)?.label ?? v;
const pmIcon  = (v: string) => PAYMENT_METHODS.find(p => p.value === v)?.icon  ?? '💳';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string;
  created_at: string;
  created_by_staff?: { name: string } | null;
  branch_name?: string | null;
}

interface Summary {
  total:           number;
  count:           number;
  revenue:         number;
  netProfit:       number;
  byCategory:      { category: string; amount: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

const BLANK = { category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash' };

export default function ExpensesPage() {
  const { user } = useUser();
  const { bar: salon } = useBar();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canDelete = ['owner', 'admin'].includes(user?.role || '');

  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading]     = useState(true);
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);

  const [pmFilter, setPmFilter]   = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Expense | null>(null);

  useModalEsc(showModal, () => setShowModal(false));
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [customCat, setCustomCat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (period === 'custom' && fromDate && toDate) { qs.set('from_date', fromDate); qs.set('to_date', toDate); }
      if (catFilter) qs.set('category', catFilter);
      if (pmFilter)  qs.set('payment_method', pmFilter);
      const res = await fetch(`/api/expenses?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExpenses(data.expenses);
      setSummary(data.summary);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate, catFilter, pmFilter]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  const openAdd = () => {
    setEditing(null);
    setForm(BLANK);
    setCustomCat(false);
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const isPreset = PRESET_CATEGORIES.includes(e.category);
    setCustomCat(!isPreset);
    setForm({ category: e.category, amount: String(e.amount), description: e.description || '', expense_date: e.expense_date, payment_method: e.payment_method || 'cash' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.category.trim()) return toast.error('Category is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const url    = editing ? `/api/expenses/${editing.id}` : '/api/expenses';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, payment_method: form.payment_method || 'cash' }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Expense updated' : 'Expense added');
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Expense deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Expenses">
        <div className="flex items-center gap-3">
          {canEdit && (
            <button onClick={openAdd} className="btn-primary text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Expense
            </button>
          )}
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Filters ── */}
        <div className="card">
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
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input">
                <option value="">All categories</option>
                {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                {summary?.byCategory.filter(b => !PRESET_CATEGORIES.includes(b.category)).map(b => (
                  <option key={b.category} value={b.category}>{b.category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Paid from</label>
              <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} className="input">
                <option value="">All accounts</option>
                {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-lg sm:text-xl font-bold text-green-600 mt-1">{formatCurrency(summary.revenue)}</p>
            </div>
            <div className="card border-l-4 border-red-500">
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.total)}</p>
              <p className="text-xs text-gray-400 mt-1">{summary.count} transaction{summary.count !== 1 ? 's' : ''}</p>
            </div>
            <div className={`card border-l-4 col-span-2 lg:col-span-2 ${
              summary.netProfit >= 0 ? 'border-blue-500' : 'border-orange-500'
            }`}>
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-lg sm:text-xl font-bold mt-1 ${
                summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'
              }`}>{formatCurrency(summary.netProfit)}</p>
              <p className="text-xs text-gray-400 mt-1">Revenue minus expenses</p>
            </div>
          </div>
        )}

        {/* ── Breakdowns ── */}
        {summary && (summary.byCategory.length > 0 || summary.byPaymentMethod.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Category */}
            {summary.byCategory.length > 0 && (
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
                <div className="space-y-2">
                  {[...summary.byCategory].sort((a, b) => b.amount - a.amount).map(b => (
                    <div key={b.category} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-28 truncate">{b.category}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round((b.amount / summary.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-28 text-right">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* By Payment Method */}
            {summary.byPaymentMethod.length > 0 && (
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Paid From</h2>
                <div className="space-y-2">
                  {[...summary.byPaymentMethod].sort((a, b) => b.amount - a.amount).map(b => (
                    <div key={b.method} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 truncate">{pmIcon(b.method)} {pmLabel(b.method)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round((b.amount / summary.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-28 text-right">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Expenses Table ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Expense Entries</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No expenses found for this period.
              {canEdit && <button onClick={openAdd} className="block mx-auto mt-3 btn-primary text-sm">Add First Expense</button>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Paid From</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Added by</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  {(canEdit || canDelete) && <th className="py-3 px-4" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium">{e.category}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs">{pmIcon(e.payment_method)} {pmLabel(e.payment_method)}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{e.description || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{e.created_by_staff?.name || '—'}</td>
                    <td className="py-3 px-4">
                      {e.branch_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {e.branch_name}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(e.amount)}</td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button onClick={() => openEdit(e)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                          )}
                          {canDelete && (
                            <button onClick={() => remove(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={6} className="py-3 px-4 text-sm font-semibold text-gray-700">Total</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(summary?.total || 0)}</td>
                  {(canEdit || canDelete) && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                {!customCat ? (
                  <div className="flex gap-2">
                    <select
                      value={PRESET_CATEGORIES.includes(form.category) ? form.category : ''}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="input flex-1"
                    >
                      <option value="">Select category…</option>
                      {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => { setCustomCat(true); setForm(f => ({ ...f, category: '' })); }}
                      className="btn-secondary text-sm whitespace-nowrap">Custom</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="input flex-1"
                      placeholder="e.g. Training, Insurance…"
                      autoFocus
                    />
                    <button type="button" onClick={() => { setCustomCat(false); setForm(f => ({ ...f, category: '' })); }}
                      className="btn-secondary text-sm">Presets</button>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input
                  type="number" min={1}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="input w-full"
                  placeholder="e.g. 50000"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="input w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input w-full"
                  placeholder="e.g. Monthly rent for salon space"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid From</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: p.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.payment_method === p.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
