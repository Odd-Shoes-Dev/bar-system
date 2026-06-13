'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useModalEsc } from '@/contexts/EscContext';

// ─── Types ────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'mtn_mobile_money' | 'airtel_money' | 'expense';
  is_system: boolean;
  balance: number;
  sort_order: number;
}

interface Transaction {
  id: string;
  amount: number;
  direction: 'in' | 'out';
  description: string | null;
  reference_type: string | null;
  transaction_date: string;
  created_at: string;
}

interface StaffAllowance {
  id: string;
  staff_id: string;
  staff_name: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'deducted' | 'cancelled';
  created_at: string;
  branch_name?: string | null;
}

interface StaffMember { id: string; name: string; }

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) =>
  'UGX ' + Math.abs(n).toLocaleString('en-UG');

const ACCOUNT_ICONS: Record<string, string> = {
  cash:             '💵',
  mtn_mobile_money: '📱',
  airtel_money:     '📲',
  expense:          '📋',
};

const ACCOUNT_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN Mobile Money',
  airtel_money:     'Airtel Money',
};

type Tab = 'revenue' | 'allowances';

export default function AccountsPage() {
  const router        = useRouter();
  const { user }      = useUser();
  const canAccess     = ['owner', 'admin'].includes(user?.role || '');
  const canAdmin      = ['owner', 'admin'].includes(user?.role || '');

  const [tab, setTab] = useState<Tab>('revenue');

  // Accounts
  const [accounts,      setAccounts]      = useState<Account[]>([]);
  const [grossRevenue,  setGrossRevenue]  = useState(0);
  const [acctLoading,   setAcctLoading]   = useState(true);

  // Recent revenue transactions (across all revenue accounts, last 50)
  const [revTxns,    setRevTxns]    = useState<(Transaction & { account_name: string })[]>([]);
  const [revLoading, setRevLoading] = useState(false);

  // Staff allowances
  const [advances,     setAdvances]     = useState<StaffAllowance[]>([]);
  const [advLoading,   setAdvLoading]   = useState(false);
  const [staffList,    setStaffList]    = useState<StaffMember[]>([]);

  // Modals
  const [addAcctModal,   setAddAcctModal]   = useState(false);
  const [advanceModal,   setAdvanceModal]   = useState(false);

  useModalEsc(addAcctModal, () => setAddAcctModal(false));
  useModalEsc(advanceModal, () => setAdvanceModal(false));

  // Forms
  const [newAcctName,  setNewAcctName]  = useState('');
  const [savingAcct,   setSavingAcct]   = useState(false);
  const [advForm, setAdvForm] = useState({ staff_id: '', amount: '', reason: '' });
  const [savingAdv,  setSavingAdv]  = useState(false);

  // ─── Load accounts ────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAcctLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error('Failed to load accounts'); return; }
      const json = await res.json();
      setAccounts(json.accounts ?? json);
      setGrossRevenue(json.grossRevenue ?? 0);
    } finally {
      setAcctLoading(false);
    }
  }, [router]);

  // ─── Load recent revenue transactions ─────────────────────────
  const loadRevTxns = useCallback(async (revAccounts: Account[]) => {
    if (revAccounts.length === 0) return;
    setRevLoading(true);
    try {
      const all: (Transaction & { account_name: string })[] = [];
      await Promise.all(
        revAccounts.map(async acct => {
          const res = await fetch(`/api/accounts/${acct.id}/transactions?limit=50`);
          if (res.ok) {
            const txns: Transaction[] = await res.json();
            txns.forEach(t => all.push({ ...t, account_name: acct.name }));
          }
        })
      );
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRevTxns(all.slice(0, 60));
    } finally {
      setRevLoading(false);
    }
  }, []);

  // ─── Load advances ─────────────────────────────────────────────
  const loadAdvances = useCallback(async () => {
    setAdvLoading(true);
    try {
      const res = await fetch('/api/staff-advances');
      if (res.ok) setAdvances(await res.json());
    } finally {
      setAdvLoading(false);
    }
  }, []);

  // ─── Load staff list ───────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) setStaffList(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user && !canAccess) { router.replace('/dashboard'); }
  }, [user, canAccess, router]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    if (tab === 'allowances' && advances.length === 0) { loadAdvances(); loadStaff(); }
  }, [tab, advances.length, loadAdvances, loadStaff]);

  useEffect(() => {
    if (tab === 'revenue' && accounts.length > 0 && revTxns.length === 0) {
      loadRevTxns(accounts);
    }
  }, [tab, accounts, revTxns.length, loadRevTxns]);

  // ─── Derived data ─────────────────────────────────────────────
  const totalAllowancesGiven = advances.filter(a => a.status !== 'cancelled').reduce((s, a) => s + Number(a.amount), 0);

  // ─── Handlers ─────────────────────────────────────────────────
  const createAccount = async () => {
    if (!newAcctName.trim()) return;
    setSavingAcct(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAcctName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Account created');
      setNewAcctName('');
      setAddAcctModal(false);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAcct(false);
    }
  };

  const giveAllowance = async () => {
    const amt = parseFloat(advForm.amount);
    if (!advForm.staff_id) { toast.error('Select a staff member'); return; }
    if (!amt || amt <= 0)   { toast.error('Enter a valid amount'); return; }
    setSavingAdv(true);
    try {
      const res = await fetch('/api/staff-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: advForm.staff_id, amount: amt, reason: advForm.reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Allowance recorded');
      setAdvanceModal(false);
      setAdvForm({ staff_id: '', amount: '', reason: '' });
      loadAdvances();
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAdv(false);
    }
  };

  const cancelAllowance = async (id: string) => {
    try {
      const res = await fetch(`/api/staff-advances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Allowance cancelled');
      loadAdvances();
    } catch {
      toast.error('Failed to cancel allowance');
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader />
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track revenue accounts and staff allowances</p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card border-t-4 border-green-400 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-green-600">{fmt(grossRevenue)}</p>
          </div>
          <div className="card border-t-4 border-orange-400 text-center">
            <p className="text-xs text-gray-500 mb-1">Allowances Given</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totalAllowancesGiven)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['revenue', 'allowances'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'allowances' ? 'Staff Allowances' : 'Revenue'}
            </button>
          ))}
        </div>

        {/* ── REVENUE TAB ───────────────────────────────────────── */}
        {tab === 'revenue' && (
          <div className="space-y-6">
            {acctLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {accounts.map(acct => (
                  <div key={acct.id} className="card border-t-4 border-brand-primary">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{ACCOUNT_ICONS[acct.type]}</span>
                      <p className="font-semibold text-gray-800 text-sm">{acct.name}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmt(Number(acct.balance))}</p>
                    <p className="text-xs text-gray-400 mt-1">Running balance</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent transactions */}
            <div className="card p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
                <span className="text-xs text-gray-400">{revTxns.length} records</span>
              </div>
              {revLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : revTxns.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No transactions yet. Complete a sale to see data here.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {revTxns.slice(0, 40).map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${t.direction === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.direction === 'in' ? '+' : '−'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.description || 'Transaction'}</p>
                          <p className="text-xs text-gray-400">{t.account_name} · {t.transaction_date}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${t.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.direction === 'in' ? '+' : '−'}{fmt(Number(t.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STAFF ALLOWANCES TAB ─────────────────────────────── */}
        {tab === 'allowances' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Total given: <span className="font-semibold text-orange-600">{fmt(totalAllowancesGiven)}</span>
                </p>
              </div>
              {canAdmin && (
                <button onClick={() => { loadStaff(); setAdvanceModal(true); }} className="btn-primary text-sm">Give Allowance</button>
              )}
            </div>

            {advLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : advances.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-3">💸</p>
                <p className="font-medium text-gray-600">No allowances recorded</p>
                <p className="text-sm text-gray-400 mt-1">Allowances given to staff will appear here</p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {advances.map(adv => (
                    <div key={adv.id} className="flex items-center gap-4 px-4 py-4">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold shrink-0">
                        {adv.staff_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{adv.staff_name}</p>
                        {adv.reason && <p className="text-xs text-gray-500">{adv.reason}</p>}
                        <p className="text-xs text-gray-400">{new Date(adv.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        {adv.branch_name && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {adv.branch_name}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(Number(adv.amount))}</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                          adv.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {adv.status === 'cancelled' ? 'Cancelled' : 'Given'}
                        </span>
                      </div>
                      {canAdmin && adv.status !== 'cancelled' && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => cancelAllowance(adv.id)}
                            className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100"
                          >
                            Undo
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Add Account ── */}
      {addAcctModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setAddAcctModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">New Account</h3>
            <input
              value={newAcctName}
              onChange={e => setNewAcctName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAccount()}
              placeholder="e.g. Rent, Salaries, Supplies…"
              className="input w-full"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setAddAcctModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={canAdmin ? createAccount : undefined} disabled={!canAdmin || savingAcct || !newAcctName.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAcct ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Give Allowance ── */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setAdvanceModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Give Staff Allowance</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
              <select value={advForm.staff_id} onChange={e => setAdvForm(p => ({ ...p, staff_id: e.target.value }))} className="input w-full">
                <option value="">Select staff…</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
              <input type="number" min="0" value={advForm.amount} onChange={e => setAdvForm(p => ({ ...p, amount: e.target.value }))} className="input w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input value={advForm.reason} onChange={e => setAdvForm(p => ({ ...p, reason: e.target.value }))} className="input w-full" placeholder="e.g. Daily allowance, transport, per diem…" />
            </div>
            <p className="text-xs text-gray-400">Recorded as a cash payment from the Cash account.</p>
            <div className="flex gap-3">
              <button onClick={() => setAdvanceModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={giveAllowance} disabled={savingAdv} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAdv ? 'Saving…' : 'Give Allowance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
