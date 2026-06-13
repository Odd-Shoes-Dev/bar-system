'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { useModalEsc } from '@/contexts/EscContext';

type StaffRole = 'owner' | 'admin' | 'staff' | 'viewer' | 'manager' | 'stylist' | 'cashier';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: StaffRole;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  branch_name?: string | null;
}


const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  owner:   { label: 'Account Owner', color: 'bg-purple-100 text-purple-800' },
  admin:   { label: 'Admin',         color: 'bg-blue-100 text-blue-800' },
  staff:   { label: 'Staff',         color: 'bg-green-100 text-green-800' },
  viewer:  { label: 'Viewer',        color: 'bg-gray-100 text-gray-700' },
  manager: { label: 'Manager',       color: 'bg-blue-100 text-blue-800' },
  stylist: { label: 'Stylist',       color: 'bg-green-100 text-green-800' },
  cashier: { label: 'Cashier',       color: 'bg-green-100 text-green-800' },
};

export default function StaffPage() {
  const router = useRouter();
  const { user } = useUser();
  const { bar: salon } = useBar();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  useModalEsc(showModal, () => setShowModal(false));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      if (response.ok) {
        const data = await response.json();
        setStaff(data);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load staff');
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const patchStaff = async (payload: Record<string, any>, successMsg: string) => {
    const response = await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed');
    }
    toast.success(successMsg);
    loadStaff();
  };

  const toggleStaffStatus = async (member: StaffMember) => {
    try {
      await patchStaff(
        { id: member.id, is_active: !member.is_active },
        `Staff member ${member.is_active ? 'deactivated' : 'activated'}`
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff status');
    }
  };

  const resetPin = async (staffId: string) => {
    try {
      await patchStaff({ id: staffId, reset_pin: true }, 'PIN reset to 1234');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset PIN');
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManageStaff = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="User Management">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Users</h1>
            <p className="text-gray-600 mt-1">Manage login access and roles</p>
          </div>
          {canManageStaff && (
            <button
              onClick={() => { setEditingStaff(null); setShowModal(true); }}
              className="btn-primary"
            >
              + Add User
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <input
                type="text"
                placeholder="Search staff by name or phone..."
                className="input-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="input-lg"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="owner">Account Owner</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{staff.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active Accounts</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {staff.filter((s) => s.is_active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Inactive Accounts</p>
            <p className="text-3xl font-bold text-gray-400 mt-1">
              {staff.filter((s) => !s.is_active).length}
            </p>
          </div>
        </div>

        {/* Staff Table */}
        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading staff...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm mt-2">
                {staff.length === 0
                  ? 'Add your first user to get started'
                  : 'Try adjusting your filters'}
              </p>
            </div>
            {canManageStaff && staff.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add user
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Staff Member
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Last Login
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  {canManageStaff && (
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.phone}</p>
                        {member.email && (
                          <p className="text-xs text-gray-400 mt-1">{member.email}</p>
                        )}
                        {member.branch_name && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {member.branch_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          ROLE_DISPLAY[member.role]?.color || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ROLE_DISPLAY[member.role]?.label || member.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600">
                      {member.last_login ? formatDate(member.last_login) : 'Never'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          member.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManageStaff && (
                      <td className="py-4 px-4 text-right">
                        {member.role === 'owner' ? (
                          <span className="text-xs text-gray-400 italic">Protected</span>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>

                            {openMenuId === member.id && (
                              <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                <button
                                  onClick={() => { setEditingStaff(member); setShowModal(true); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg border-b border-gray-100"
                                >
                                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Edit Details</span>
                                </button>
                                <button
                                  onClick={() => { resetPin(member.id); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                                >
                                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>Reset PIN to 1234</span>
                                </button>
                                <button
                                  onClick={() => { toggleStaffStatus(member); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                                >
                                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={member.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} /></svg>{member.is_active ? 'Deactivate' : 'Activate'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Notice - Removed since API is now available */}
      </div>

      {/* Add/Edit Modal */}
      {showModal && canManageStaff && (
        <StaffModal
          staff={editingStaff}
          actingUserRole={(user?.role as StaffRole) || 'admin'}
          onClose={() => {
            setShowModal(false);
            setEditingStaff(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingStaff(null);
            loadStaff();
          }}
        />
      )}
    </div>
  );
}

// Staff Modal Component
function StaffModal({
  staff,
  actingUserRole,
  onClose,
  onSuccess,
}: {
  staff: StaffMember | null;
  actingUserRole: StaffRole;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { bar: salon } = useBar();
  const [name, setName] = useState(staff?.name || '');
  const [phone, setPhone] = useState(staff?.phone || '');
  const [email, setEmail] = useState(staff?.email || '');
  const [role, setRole] = useState<StaffRole>(staff?.role || 'staff');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Branch assignment — owner only
  const [branchId, setBranchId] = useState<string>(
    (staff as any)?.branch_id || ''
  );
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const branchesFetched = useRef(false);

  useEffect(() => {
    if (actingUserRole !== 'owner' || branchesFetched.current) return;
    branchesFetched.current = true;
    fetch('/api/branches')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string; is_active: boolean }[]) =>
        setBranches(data.filter(b => b.is_active !== false))
      )
      .catch(() => {});
  }, [actingUserRole]);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    admin:   'Full access to all features. Can manage staff (except owner).',
    staff:   'Can use POS, view clients and services.',
    viewer:  'Read-only access to dashboard and reports. Cannot use POS.',
    manager: 'Legacy role — same as Admin.',
    stylist: 'Legacy role — same as Staff.',
    cashier: 'Legacy role — same as Staff.',
  };

  const baseRoles: { value: StaffRole; label: string }[] =
    actingUserRole === 'owner'
      ? [
          { value: 'admin',  label: 'Admin'  },
          { value: 'staff',  label: 'Staff'  },
          { value: 'viewer', label: 'Viewer' },
        ]
      : [
          { value: 'staff',  label: 'Staff'  },
          { value: 'viewer', label: 'Viewer' },
        ];

  const LEGACY_LABELS: Partial<Record<StaffRole, string>> = {
    manager: 'Manager (Legacy)',
    stylist:  'Stylist (Legacy)',
    cashier:  'Cashier (Legacy)',
  };

  // When editing, ensure the staff's current role is always in the list
  const availableRoles = (() => {
    const currentRole = staff?.role;
    if (
      currentRole &&
      currentRole !== 'owner' &&
      !baseRoles.some((r) => r.value === currentRole)
    ) {
      return [
        { value: currentRole, label: LEGACY_LABELS[currentRole] || currentRole },
        ...baseRoles,
      ];
    }
    return baseRoles;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !phone || !role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!staff && !pin && !password) {
      toast.error('Provide at least a PIN or a password');
      return;
    }

    if (pin && pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    if (newPin && newPin.length !== 4) {
      toast.error('New PIN must be exactly 4 digits');
      return;
    }

    setSubmitting(true);

    try {
      // Include branch_id only when acting as owner (API enforces this too)
      const branchPayload = actingUserRole === 'owner'
        ? { branch_id: branchId || null }
        : {};

      const payload = staff
        ? { id: staff.id, name, phone, email: email || undefined, role, new_pin: newPin || undefined, new_password: newPassword || undefined, ...branchPayload }
        : { name, phone, email: email || undefined, role, pin: pin || undefined, password: password || undefined, ...branchPayload };

      const response = await fetch('/api/staff', {
        method: staff ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save staff');
      }

      toast.success(staff ? 'Staff updated successfully' : 'Staff member created successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {staff ? 'Edit User' : 'Add New User'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Jane Doe"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+256700000000"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="jane@example.com"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {ROLE_DESCRIPTIONS[role] && (
              <p className="text-xs text-gray-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
            )}
          </div>

          {/* Branch assignment — owner only, only shown when salon has >1 branch */}
          {actingUserRole === 'owner' && branches.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
                {!staff && <span className="text-gray-400 font-normal ml-1">(required)</span>}
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!staff}
              >
                <option value="">Select branch…</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This determines which branch data the user can see and record in.
              </p>
            </div>
          )}

          {/* Credentials for new staff */}
          {!staff && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">Login Credentials</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">4-Digit PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl tracking-widest text-center"
                  placeholder="••••"
                />
                <p className="text-xs text-gray-500 mt-1">For quick PIN login on POS</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For email/password login"
                />
                <p className="text-xs text-gray-500 mt-1">Required for Admins and Viewers (no POS access)</p>
              </div>
            </div>
          )}

          {/* Credentials update for existing staff */}
          {staff && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">Update Credentials (Optional)</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set New PIN</label>
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to keep current PIN"
                />
                <p className="text-xs text-gray-500 mt-1">4 digits — for quick PIN login</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Saving...' : staff ? 'Update Staff' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
