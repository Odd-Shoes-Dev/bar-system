'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Client, Visit } from '@/types';
import { SalonHeader } from '@/components/SalonBranding';
import { formatCurrency } from '@/lib/utils';
import { useBar } from '@/contexts/BarContext';

const PERIODS = [
  { value: 'all',        label: 'All Time' },
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
];

function getPeriodRange(period: string): { from: string; to: string } | null {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      return { from: d.toISOString().split('T')[0], to: today };
    }
    case 'month':
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return { from: d.toISOString().split('T')[0], to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0] };
    }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default: return null;
  }
}

export default function ClientProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const { bar: salon } = useBar();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const clientId = String(params.id);

  const [client, setClient]           = useState<Client | null>(null);
  const [visits, setVisits]           = useState<Visit[]>([]);
  const [loading, setLoading]         = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [period, setPeriod]           = useState('all');
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // Load static client info once
  useEffect(() => {
    (async () => {
      try {
        const clientRes = await fetch(`/api/clients/${clientId}`);
        if (clientRes.status === 401) { router.push('/login'); return; }
        if (clientRes.status === 404) { setClient(null); setLoading(false); return; }
        const clientData = await clientRes.json();
        setClient(clientData || null);
      } catch { alert('Failed to load client'); }
      finally { setLoading(false); }
    })();
  }, [clientId, router]);

  // Load visits whenever period changes
  const loadVisits = useCallback(async () => {
    setVisitsLoading(true);
    try {
      const range = getPeriodRange(period);
      const qs = new URLSearchParams({ client_id: clientId, limit: '200' });
      if (range) { qs.set('from_date', range.from); qs.set('to_date', range.to); }
      const res = await fetch(`/api/visits?${qs}`);
      if (res.ok) setVisits(await res.json());
    } finally { setVisitsLoading(false); }
  }, [clientId, period]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Derived period stats
  const periodTotal = visits.reduce((s, v) => s + Number(v.total_amount), 0);
  const periodAvg   = visits.length > 0 ? periodTotal / visits.length : 0;

  const serviceCounts: Record<string, { name: string; count: number }> = {};
  visits.forEach(v => {
    (v.visit_services || []).forEach((vs: any) => {
      const sname = vs.service?.name || 'Unknown';
      serviceCounts[sname] = serviceCounts[sname] || { name: sname, count: 0 };
      serviceCounts[sname].count += vs.quantity || 1;
    });
  });
  const topService = Object.values(serviceCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Client not found</p>
        <Link href="/clients" className="btn-primary">Back to Clients</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Client Profile">
        <Link href="/clients" className="btn-secondary text-sm">← All Clients</Link>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Client Identity Card ── */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-2xl font-bold shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
                <p className="text-gray-500">{client.phone}</p>
                {client.email && <p className="text-gray-400 text-sm">{client.email}</p>}
              </div>
            </div>

            <div className="md:ml-auto grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{client.total_visits}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Visits</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(client.total_spent)}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Spend</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-900">{client.last_visit ? new Date(client.last_visit).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Last Visit</p>
                {(client as any).last_visit_branch_name && (
                  <p className="text-xs text-brand-primary mt-0.5 font-medium">{(client as any).last_visit_branch_name}</p>
                )}
              </div>
              {(client as any).registered_at_branch_name && (
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900">{(client as any).registered_at_branch_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Registered At</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Period Selector ── */}
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {PERIODS.map(p => {
            const active = period === p.value;
            return (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ── Period Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-500">Visits</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : visits.length}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : formatCurrency(periodTotal)}</p>
          </div>
          <div className="card border-l-4 border-blue-400">
            <p className="text-sm text-gray-500">Avg per Visit</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : formatCurrency(periodAvg)}</p>
          </div>
          <div className="card border-l-4 border-purple-400">
            <p className="text-sm text-gray-500">Top Service</p>
            <p className="text-sm font-bold text-gray-900 mt-1 truncate">{visitsLoading ? '…' : topService?.name || '—'}</p>
            {topService && <p className="text-xs text-gray-400">{topService.count}× booked</p>}
          </div>
        </div>

        {/* ── Visit History ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Visit History</h3>
            <span className="text-sm text-gray-400">{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
          </div>

          {visitsLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : visits.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No visits in this period.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visits.map(visit => {
                const expanded = expandedId === visit.id;
                const staffName = (visit as any).staff?.name;
                return (
                  <div key={visit.id}>
                    <button
                      className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(expanded ? null : visit.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(visit.created_at).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-gray-500">
                              #{visit.receipt_number}{staffName ? ` · ${staffName}` : ''}
                            </p>
                            {(visit as any).branch_name && (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {(visit as any).branch_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <p className="font-bold text-gray-900">{formatCurrency(visit.total_amount)}</p>
                          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="pt-3 space-y-1">
                          {(visit.visit_services || []).map((vs: any) => (
                            <div key={vs.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">{vs.quantity}× {vs.service?.name || 'Unknown service'}</span>
                              <span className="font-medium text-gray-900">{formatCurrency((vs.unit_price || vs.price || 0) * (vs.quantity || 1))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                            <span>{visit.payment_method.replace('_', ' ').toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              visit.payment_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{visit.payment_status}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
