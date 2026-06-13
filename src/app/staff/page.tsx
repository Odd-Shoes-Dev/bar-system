'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency } from '@/lib/utils';

interface StaffMember {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  job_title: string;
  hire_date: string | null;
  hourly_rate: number | null;
  commission_rate: number | null;
  is_active: boolean;
  notes: string | null;
  branch_id: string | null;
  branch_name: string | null;
  user_id: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

const JOB_TITLES = ['Bartender', 'Head Bartender', 'Server', 'Waiter', 'Manager', 'Security', 'Cleaner', 'Cashier', 'Other'];

export default function StaffPage() {
  const router = useRouter();
  const { bar: salon } = useBar();
  const { user } = useUser();
  const brandColor = salon?.theme_primary_color || '#6366f1';

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '', phone: '', email: '', job_title: 'Bartender',
    hire_date: '', hourly_rate: '', commission_rate: '',
    notes: '', branch_id: '', is_active: true,
  });

  const canManage = user && ['owner', 'admin', 'manager'].includes(user.role);

  useEffect(() => {
    loadStaff();
    loadBranches();
  }, []);

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setStaff(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    const res = await fetch('/api/branches');
    if (res.ok) setBranches(await res.json());
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', job_title: 'Bartender', hire_date: '', hourly_rate: '', commission_rate: '', notes: '', branch_id: '', is_active: true });
    setShowModal(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({
      name: member.name,
      phone: member.phone || '',
      email: member.email || '',
      job_title: member.job_title,
      hire_date: member.hire_date?.split('T')[0] || '',
      hourly_rate: member.hourly_rate?.toString() || '',
      commission_rate: member.commission_rate?.toString() || '',
      notes: member.notes || '',
      branch_id: member.branch_id || '',
      is_active: member.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        job_title: form.job_title,
        hire_date: form.hire_date || null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
        notes: form.notes || null,
        branch_id: form.branch_id || null,
        is_active: form.is_active,
      };

      const res = await fetch('/api/staff', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        await loadStaff();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = staff.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.job_title.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search)
  );

  const active = filtered.filter(m => m.is_active);
  const inactive = filtered.filter(m => !m.is_active);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bar employees — bartenders, servers, security and more</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            + Add Staff
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name, role or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': brandColor } as any}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No staff found</p>
          <p className="text-sm mt-1">Add your first bar employee to get started</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Active — {active.length}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map(m => <StaffCard key={m.id} member={m} brandColor={brandColor} onEdit={canManage ? openEdit : undefined} />)}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Inactive — {inactive.length}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-60">
                {inactive.map(m => <StaffCard key={m.id} member={m} brandColor={brandColor} onEdit={canManage ? openEdit : undefined} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': brandColor } as any} placeholder="e.g. John Doe" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Job Title *</label>
                  <select required value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                    {JOB_TITLES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hire Date</label>
                  <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" placeholder="+256 700 000 000" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate</label>
                  <input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" placeholder="0" min="0" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Commission %</label>
                  <input type="number" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" placeholder="0" min="0" max="100" />
                </div>

                {branches.length > 1 && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                    <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                      <option value="">— Unassigned —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none" />
                </div>

                {editing && (
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: brandColor }}>
                  {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffCard({ member, brandColor, onEdit }: { member: StaffMember; brandColor: string; onEdit?: (m: StaffMember) => void }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ backgroundColor: brandColor }}>
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 truncate">{member.name}</span>
          {onEdit && (
            <button onClick={() => onEdit(member)}
              className="text-xs text-gray-400 hover:text-gray-700 shrink-0">Edit</button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{member.job_title}</p>
        {member.branch_name && (
          <p className="text-xs text-gray-400 mt-0.5">📍 {member.branch_name}</p>
        )}
        {member.phone && (
          <p className="text-xs text-gray-400 mt-0.5">{member.phone}</p>
        )}
        {member.hire_date && (
          <p className="text-xs text-gray-400 mt-0.5">
            Hired {new Date(member.hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
