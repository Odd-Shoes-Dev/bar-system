'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useBar } from '@/contexts/BarContext';

interface Branch {
  id: string;
  name: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { bar: salon } = useBar();
  const [method, setMethod] = useState<'pin' | 'password'>('pin');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Skip login page if already authenticated
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user?.id) router.replace('/dashboard'); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load branches for this salon
  useEffect(() => {
    if (!salon?.subdomain) return;

    const params = new URLSearchParams({ subdomain: salon.subdomain });
    fetch(`/api/branches/public?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Branch[]) => {
        setBranches(data);
        // Auto-select if only one branch
        if (data.length === 1) setBranchId(data[0].id);
        setBranchesLoaded(true);
      })
      .catch(() => setBranchesLoaded(true));
  }, [salon?.subdomain]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining === 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate branch selection when salon has multiple branches
    if (branches.length > 1 && !branchId) {
      setError('Please select your branch to continue.');
      return;
    }

    setLoading(true);

    try {
      const subdomain = salon?.subdomain || 'posh';

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          phone:      method === 'pin'      ? phone      : undefined,
          pin:        method === 'pin'      ? pin        : undefined,
          identifier: method === 'password' ? identifier : undefined,
          password:   method === 'password' ? password   : undefined,
          subdomain,
          branch_id: branchId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const brandColor = salon?.theme_primary_color || '#2563EB';
  const showBranchSelector = branchesLoaded && branches.length > 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          {salon?.logo_url ? (
            <div className="flex justify-center mb-4">
              <div className="w-32 h-32 flex items-center justify-center">
                <Image src={salon.logo_url} alt={salon.name} width={128} height={128} className="object-contain" />
              </div>
            </div>
          ) : (
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4"
              style={{ backgroundColor: brandColor }}
            >
              {salon?.name.charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          {salon?.slogan && (
            <p className="text-slate-600 text-sm mt-4 italic font-medium">"{salon.slogan}"</p>
          )}
          <p className="text-slate-600 text-sm mt-2">Sign in to continue</p>
        </div>

        {/* Branch selector — only shown when salon has multiple branches */}
        {showBranchSelector && (
          <div className="mb-5 p-3 rounded-xl border" style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}30` }}>
            <label htmlFor="branch" className="block text-sm font-medium text-slate-700 mb-2">
              Select your branch
            </label>
            <select
              id="branch"
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              required
              className="input"
            >
              <option value="">— Choose branch —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Login Method Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMethod('pin')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              method === 'pin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quick PIN
          </button>
          <button
            type="button"
            onClick={() => setMethod('password')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              method === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Email & Password
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
            {lockedUntil && lockCountdown > 0 && (
              <p className="mt-1 font-mono text-red-500">
                Unlocks in {Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, '0')}
              </p>
            )}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'pin' ? (
            <>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+256 700 000 000"
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-2">
                  4-Digit PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value.slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  className="input text-center text-2xl tracking-widest"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-slate-700 mb-2">
                  Email or Phone Number
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +256700000000"
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || !!lockedUntil}
            className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}
          >
            {loading ? 'Signing in...' : lockedUntil ? 'Account Locked' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
