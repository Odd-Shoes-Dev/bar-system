'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  active_staff_count: number;
  created_at: string;
}

const emptyForm = { name: '', address: '', phone: '', email: '' };

export default function BranchesPage() {
  const { user } = useUser();
  const { bar: salon } = useBar();
  const router = useRouter();

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Only owner can manage branches
  useEffect(() => {
    if (user && user.role !== 'owner') {
      router.replace('/settings');
    }
  }, [user, router]);

  const loadBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({ name: b.name, address: b.address || '', phone: b.phone || '', email: b.email || '' });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Branch name is required'); return; }

    setSaving(true);
    try {
      const url    = editingId ? `/api/branches/${editingId}` : '/api/branches';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          address: form.address.trim() || null,
          phone:   form.phone.trim()   || null,
          email:   form.email.trim()   || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save branch'); return; }

      toast.success(editingId ? 'Branch updated' : 'Branch created');
      setShowForm(false);
      loadBranches();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !branch.is_active }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
      toast.success(branch.is_active ? 'Branch deactivated' : 'Branch activated');
      loadBranches();
    } catch {
      toast.error('Something went wrong');
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Delete "${branch.name}"? All historical data will be preserved but this branch will be archived.`)) return;

    setDeletingId(branch.id);
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.staff_count) {
          if (confirm(data.error + '\n\nForce delete anyway?')) {
            const res2 = await fetch(`/api/branches/${branch.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true }),
            });
            if (res2.ok) { toast.success('Branch deleted'); loadBranches(); }
            else { const d2 = await res2.json(); toast.error(d2.error || 'Failed'); }
          }
          return;
        }
        toast.error(data.error || 'Failed to delete branch');
        return;
      }

      toast.success('Branch deleted');
      loadBranches();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setDeletingId(null);
    }
  };

  if (user?.role !== 'owner') return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your salon locations. Each branch has isolated data.</p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 !min-h-0 !py-2 !px-4 !text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Branch
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="mb-6 card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Branch' : 'Create New Branch'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Downtown Branch"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+256 700 000 000"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="123 Main Street, Kampala"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="branch@salon.com"
                  className="input"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary !min-h-0 !py-2 !px-4 !text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary !min-h-0 !py-2 !px-4 !text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="font-medium">No branches yet</p>
          <p className="text-sm mt-1">Create your first branch to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map(branch => (
            <div
              key={branch.id}
              className={`card transition-all ${!branch.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{branch.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        branch.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {branch.address && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {branch.address}
                      </span>
                    )}
                    {branch.phone && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {branch.phone}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex gap-4">
                    <span className="text-xs text-gray-400">
                      <span className="font-medium text-gray-600">{branch.active_staff_count}</span> staff
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit */}
                  <button
                    onClick={() => openEdit(branch)}
                    className="p-1.5 text-gray-400 rounded-lg transition-colors hover:bg-gray-100"
                    style={{ '--hover-color': brandColor } as React.CSSProperties}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = brandColor; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                    title="Edit branch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(branch)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      branch.is_active
                        ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                    }`}
                    title={branch.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {branch.is_active ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(branch)}
                    disabled={deletingId === branch.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Delete branch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box — neutral gray */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">How branches work</p>
        <ul className="space-y-1 text-gray-500 text-xs list-disc list-inside">
          <li>Each staff member is assigned to one branch and only sees data from their branch.</li>
          <li>As owner you can view all branches or switch branch context from the dashboard.</li>
          <li>Services and clients are shared across all branches.</li>
          <li>Visits, expenses, and staff are isolated per branch.</li>
          <li>Deleting a branch archives it — historical data is never lost.</li>
        </ul>
      </div>
    </div>
  );
}
