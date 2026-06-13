'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useSidebar } from '@/contexts/SidebarContext';

type Tab = 'general' | 'branding' | 'sms';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general',  label: 'General' },
  { key: 'branding', label: 'Branding' },
  { key: 'sms',      label: 'SMS / Receipt' },
];

const SMS_VARS = [
  '{salonName}', '{clientName}', '{services}', '{total}',
  '{receiptNumber}', '{paymentMethod}',
];

interface SalonSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  slogan: string;
  logo_url: string;
  theme_primary_color: string;
  theme_secondary_color: string;
}

const DEFAULTS: SalonSettings = {
  name: '', phone: '', email: '', address: '', city: '', slogan: '',
  logo_url: '', theme_primary_color: '#E31C23', theme_secondary_color: '#111827',
};

export default function SettingsPage() {
  const router  = useRouter();
  const { user } = useUser();
  const [tab, setTab]           = useState<Tab>('general');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState<SalonSettings>(DEFAULTS);

  // SMS state
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsSaving, setSmsSaving]     = useState(false);
  const [testPhone, setTestPhone]     = useState('');
  const [testText, setTestText]       = useState('');
  const [sending, setSending]         = useState(false);
  const [smsLoaded, setSmsLoaded]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const { expanded, toggle } = useSidebar();
  const smsChars = useMemo(() => smsTemplate.length, [smsTemplate]);

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { if (tab === 'sms' && !smsLoaded) loadSmsTemplate(); }, [tab]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setForm({
        name:                  data.name                  ?? '',
        phone:                 data.phone                 ?? '',
        email:                 data.email                 ?? '',
        address:               data.address               ?? '',
        city:                  data.city                  ?? '',
        slogan:                data.slogan                ?? '',
        logo_url:              data.logo_url              ?? '',
        theme_primary_color:   data.theme_primary_color   ?? '#E31C23',
        theme_secondary_color: data.theme_secondary_color ?? '#111827',
      });
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadSmsTemplate = async () => {
    try {
      const res = await fetch('/api/sms/template');
      const data = await res.json();
      setSmsTemplate(data.template || '');
      setTestText(data.template || '');
      setSmsLoaded(true);
    } catch {
      toast.error('Failed to load SMS template');
    }
  };

  const saveSettings = async () => {
    if (!form.name.trim()) { toast.error('Salon name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Settings saved — reload the page to see branding changes');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveSmsTemplate = async () => {
    setSmsSaving(true);
    try {
      const res = await fetch('/api/sms/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: smsTemplate }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('SMS template saved');
      setTestText(smsTemplate);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save template');
    } finally {
      setSmsSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim() || !testText.trim()) { toast.error('Enter a phone number and message'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone, text: testText }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Test SMS sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('logo_url', data.logo_url);
      toast.success('Logo uploaded successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const set = (key: keyof SalonSettings, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading settings…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Settings">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6 max-w-3xl">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                tab === t.key
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── GENERAL TAB ───────────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Salon Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salon Name *</label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Posh Nailcare"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slogan / Tagline</label>
                  <input
                    value={form.slogan}
                    onChange={e => set('slogan', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Beauty Redefined"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Kampala"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. 123 Kampala Road"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Contact Details</h2>
              <p className="text-sm text-gray-500 mb-4">These appear on receipts sent to clients.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="+256 700 000 000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="hello@yoursalon.com"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Display Preferences</h2>
              <p className="text-sm text-gray-500 mb-4">Personal preferences saved to your browser only.</p>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Expanded sidebar</p>
                  <p className="text-xs text-gray-500 mt-0.5">Show labels next to navigation icons</p>
                </div>
                <button
                  onClick={toggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    expanded ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={expanded}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      expanded ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {user?.role === 'owner' && (
              <div
                className="card"
                style={{ borderColor: `${form.theme_primary_color}30`, backgroundColor: `${form.theme_primary_color}08` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Branch Management</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Create and manage your salon locations.</p>
                  </div>
                  <Link
                    href="/settings/branches"
                    className="btn-primary flex items-center gap-2 !min-h-0 !py-2 !px-4 !text-sm shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Manage Branches
                  </Link>
                </div>
              </div>
            )}

            {canEdit && (
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}

        {/* ── BRANDING TAB ─────────────────────────────────────────── */}
        {tab === 'branding' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Logo</h2>
              <p className="text-sm text-gray-500 mb-4">Upload your salon logo. It appears on receipts and the login page.</p>

              <div className="flex items-start gap-5">
                {/* Preview box */}
                <div
                  className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
                  onClick={() => canEdit && fileInputRef.current?.click()}
                  title={canEdit ? 'Click to upload logo' : undefined}
                >
                  {uploading ? (
                    <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-1 text-white"
                      style={{ backgroundColor: form.theme_primary_color }}
                    >
                      <span className="text-2xl font-bold">{(form.name || 'S').charAt(0).toUpperCase()}</span>
                      {canEdit && <span className="text-[10px] opacity-75">Upload</span>}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  {/* File upload */}
                  {canEdit && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {uploading ? 'Uploading…' : 'Upload Image'}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, SVG or GIF · max 2 MB</p>
                    </div>
                  )}

                  {form.logo_url && canEdit && (
                    <button
                      type="button"
                      onClick={() => set('logo_url', '')}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Brand Colors</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.theme_primary_color}
                      onChange={e => set('theme_primary_color', e.target.value)}
                      disabled={!canEdit}
                      className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                    />
                    <input
                      value={form.theme_primary_color}
                      onChange={e => set('theme_primary_color', e.target.value)}
                      disabled={!canEdit}
                      className="input flex-1 font-mono uppercase"
                      placeholder="#E31C23"
                      maxLength={7}
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: form.theme_primary_color }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.theme_secondary_color}
                      onChange={e => set('theme_secondary_color', e.target.value)}
                      disabled={!canEdit}
                      className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                    />
                    <input
                      value={form.theme_secondary_color}
                      onChange={e => set('theme_secondary_color', e.target.value)}
                      disabled={!canEdit}
                      className="input flex-1 font-mono uppercase"
                      placeholder="#111827"
                      maxLength={7}
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: form.theme_secondary_color }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Color changes take effect after the page is reloaded.</p>
            </div>

            {canEdit && (
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}

        {/* ── SMS TAB ───────────────────────────────────────────────── */}
        {tab === 'sms' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-900">Receipt SMS Template</h2>
                <span className="text-xs text-gray-400">{smsChars} chars</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Sent to clients after checkout. Use variables below to personalise the message.
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                SMS delivery currently supports <strong className="font-semibold">Airtel numbers only</strong>. Messages to other networks will not be delivered.
              </div>
              <textarea
                value={smsTemplate}
                onChange={e => setSmsTemplate(e.target.value)}
                disabled={!canEdit}
                rows={7}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono resize-y"
                placeholder="Thank you {clientName} for visiting {salonName}…"
              />
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Insert variable</p>
                <div className="flex flex-wrap gap-2">
                  {SMS_VARS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSmsTemplate(prev => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${v}`)}
                      className="px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {canEdit && (
                <div className="mt-4">
                  <button onClick={saveSmsTemplate} disabled={smsSaving} className="btn-primary text-sm">
                    {smsSaving ? 'Saving…' : 'Save Template'}
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Send Test SMS</h2>
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Phone</label>
                  <input
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="+256 700 000 000"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  SMS delivers to <strong className="font-semibold">Airtel numbers only</strong>. Messages to other networks will not be delivered.
                </div>
                <button onClick={sendTestSms} disabled={sending} className="btn-secondary text-sm w-fit">
                  {sending ? 'Sending…' : 'Send Test SMS'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
