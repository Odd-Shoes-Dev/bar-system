'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useUser } from '@/contexts/UserContext';

interface BranchOption {
  id: string;
  name: string;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pos',
    label: 'New Sale',
    href: '/pos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'clients',
    label: 'Customers',
    href: '/clients',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'services',
    label: 'Menu',
    href: '/menu',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'accounts',
    label: 'Accounts',
    href: '/accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: 'expenses',
    label: 'Expenses',
    href: '/expenses',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'addons',
    label: 'Add-ons',
    href: '/addons',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: 'staff',
    label: 'Staff',
    href: '/staff',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    href: '/users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const { bar: salon } = useBar();
  const { user } = useUser();
  const { expanded, toggle } = useSidebar();
  const visibleNav = NAV_ITEMS.filter(item =>
    item.id !== 'accounts' || ['owner', 'admin'].includes(user?.role || '')
  );
  const [fabOpen, setFabOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navTooltip, setNavTooltip] = useState<{ label: string; y: number } | null>(null);
  const primaryColor = salon?.theme_primary_color || '#E31C23';
  const router = useRouter();

  // ── Branch switcher state (owner only) ──────────────────────────────────
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  // Refs: wrapperRef covers both the toggle button and the fixed dropdown
  // so the click-outside handler ignores clicks inside either element.
  const branchWrapperRef = useRef<HTMLDivElement>(null);
  const branchButtonRef  = useRef<HTMLButtonElement>(null);
  const branchPanelRef   = useRef<HTMLDivElement>(null);
  // Pixel coords for the fixed dropdown (so it clears overflow:hidden parents)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Close branch dropdown when clicking outside both the button and the panel
  useEffect(() => {
    if (!branchDropdownOpen) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !branchButtonRef.current?.contains(t) &&
        !branchPanelRef.current?.contains(t)
      ) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [branchDropdownOpen]);

  const handleBranchDropdownToggle = async () => {
    // Fetch branches on first open
    if (!branchDropdownOpen && branches.length === 0) {
      setLoadingBranches(true);
      try {
        const res = await fetch('/api/branches');
        if (res.ok) {
          const data: any[] = await res.json();
          setBranches(data.map(b => ({ id: b.id, name: b.name })));
        }
      } finally {
        setLoadingBranches(false);
      }
    }
    // Capture button position so the fixed panel can align to it
    if (!branchDropdownOpen && branchButtonRef.current) {
      const r = branchButtonRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 6, left: r.left });
    }
    setBranchDropdownOpen(o => !o);
  };

  const handleBranchSwitch = async (branchId: string | null) => {
    if (switchingBranch) return;
    // Already on the selected branch — just close
    if (branchId === user?.branch_id) { setBranchDropdownOpen(false); return; }
    setSwitchingBranch(true);
    try {
      const res = await fetch('/api/auth/switch-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId }),
      });
      if (res.ok) {
        setBranchDropdownOpen(false);
        // Full reload so every piece of page data reflects the new branch context
        window.location.href = pathname;
      }
    } finally {
      setSwitchingBranch(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Hide on login page
  if (pathname === '/login' || pathname === '/') return null;

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <>
      {/* ── Desktop: Collapsible left sidebar ── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full flex-col bg-white border-r border-gray-200 shadow-sm z-30 transition-all duration-200"
        style={{ width: expanded ? '208px' : '64px' }}
      >
        {/* Brand mark */}
        <div className={`flex items-center h-16 border-b border-gray-100 shrink-0 overflow-hidden ${expanded ? 'px-3 gap-3' : 'justify-center'}`}>
          <div className="shrink-0">
            {salon?.logo_url ? (
              <Image src={salon.logo_url} alt={salon.name} width={36} height={36} className="w-9 h-9 object-contain rounded-lg" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                {salon?.name?.charAt(0) || 'S'}
              </div>
            )}
          </div>
          <div className={`flex flex-col min-w-0 transition-all duration-150 ${expanded ? 'opacity-100 flex-1' : 'opacity-0 w-0 overflow-hidden'}`}>
            <span className="text-sm font-semibold text-gray-900 truncate">{salon?.name || 'Bar'}</span>

            {/* Non-owner: show their fixed branch (no switching) */}
            {user?.role !== 'owner' && user?.branch_name && (
              <span className="text-xs text-gray-500 truncate flex items-center gap-1">
                <span>📍</span>
                <span className="truncate">{user.branch_name}</span>
              </span>
            )}

            {/* Owner: clickable branch switcher */}
            {user?.role === 'owner' && (
              <div className="relative" ref={branchWrapperRef}>
                <button
                  ref={branchButtonRef}
                  onClick={handleBranchDropdownToggle}
                  className="flex items-center gap-0.5 text-xs max-w-full hover:opacity-70 transition-opacity"
                  style={{ color: primaryColor }}
                  title="Switch branch view"
                >
                  <span className="truncate">
                    {user.branch_name ? `📍 ${user.branch_name}` : 'All Branches'}
                  </span>
                  {/* Chevron */}
                  <svg
                    className={`w-3 h-3 shrink-0 transition-transform duration-150 ${branchDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown panel — fixed so it escapes overflow:hidden parents */}
                {branchDropdownOpen && (
                  <div
                    ref={branchPanelRef}
                    className="fixed w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] py-1 overflow-hidden"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                  >
                    {loadingBranches ? (
                      <div className="px-3 py-2 text-xs text-gray-400">Loading branches…</div>
                    ) : (
                      <>
                        {/* All Branches option */}
                        <button
                          onClick={() => handleBranchSwitch(null)}
                          disabled={switchingBranch}
                          className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                          style={!user.branch_id ? { color: primaryColor, fontWeight: 600, backgroundColor: `${primaryColor}0d` } : { color: '#374151' }}
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                          </svg>
                          All Branches
                          {!user.branch_id && (
                            <svg className="w-3 h-3 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>

                        {/* Individual branches */}
                        {branches.map(b => (
                          <button
                            key={b.id}
                            onClick={() => handleBranchSwitch(b.id)}
                            disabled={switchingBranch}
                            className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                            style={user.branch_id === b.id ? { color: primaryColor, fontWeight: 600, backgroundColor: `${primaryColor}0d` } : { color: '#374151' }}
                          >
                            <span className="shrink-0">📍</span>
                            <span className="truncate">{b.name}</span>
                            {user.branch_id === b.id && (
                              <svg className="w-3 h-3 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}

                        {!loadingBranches && branches.length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-400">No branches found</div>
                        )}
                      </>
                    )}

                    {/* Switching indicator */}
                    {switchingBranch && (
                      <div className="px-3 py-1.5 text-xs text-center border-t border-gray-100" style={{ color: primaryColor }}>
                        Switching…
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav
          className={`flex-1 flex flex-col py-4 gap-1 overflow-y-auto scrollbar-hide ${expanded ? 'items-stretch px-2' : 'items-center'}`}
          onScroll={() => setNavTooltip(null)}
        >
          {visibleNav.map(item => {
            const active = isActive(item.href);
            return (
              <div
                key={item.id}
                className={`relative w-full flex ${expanded ? '' : 'justify-center'}`}
                onMouseEnter={!expanded ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setNavTooltip({ label: item.label, y: rect.top + rect.height / 2 });
                } : undefined}
                onMouseLeave={!expanded ? () => setNavTooltip(null) : undefined}
              >
                <Link
                  href={item.href}
                  className={`relative flex items-center transition-all duration-150 ${
                    expanded
                      ? `w-full px-3 py-2 rounded-xl gap-3 ${
                          active ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                        }`
                      : `justify-center w-10 h-10 rounded-xl ${
                          active ? 'text-white shadow-md' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`
                  }`}
                  style={active ? { backgroundColor: primaryColor } : {}}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className={`whitespace-nowrap overflow-hidden text-sm font-medium transition-all duration-150 ${expanded ? 'opacity-100 max-w-[200px]' : 'max-w-0 opacity-0'}`}>
                    {item.label}
                  </span>
                  {/* Active dot — collapsed only */}
                  {!expanded && active && (
                    <span
                      className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Fixed-position tooltip — rendered outside scroll container so it never clips */}
        {!expanded && navTooltip && (
          <div
            className="fixed z-[9999] flex items-center pointer-events-none"
            style={{ left: '68px', top: `${navTooltip.y}px`, transform: 'translateY(-50%)' }}
          >
            <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
            <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              {navTooltip.label}
            </span>
          </div>
        )}

        {/* Bottom utilities */}
        <div className={`shrink-0 flex flex-col pb-4 gap-1 ${expanded ? 'items-stretch px-2' : 'items-center'}`}>
          <div className={`h-px bg-gray-100 mb-1 ${expanded ? 'mx-1' : 'w-10'}`} />

          {/* Search */}
          <div className={`relative flex w-full ${expanded ? '' : 'justify-center group'}`}>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
              className={`flex items-center transition-all duration-150 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl ${
                expanded ? 'w-full px-3 py-2 gap-3' : 'justify-center w-10 h-10'
              }`}
            >
              <span className="shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-150 flex items-center gap-1.5 ${expanded ? 'opacity-100 max-w-[200px]' : 'max-w-0 opacity-0'}`}>
                Search <kbd className="text-xs opacity-50 font-mono bg-gray-100 px-1 rounded">Ctrl K</kbd>
              </span>
            </button>
            {!expanded && (
              <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                  <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">Search <kbd className="opacity-60">Ctrl K</kbd></span>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <div className={`relative flex w-full ${expanded ? '' : 'justify-center group'}`}>
            <button
              onClick={handleLogout}
              className={`flex items-center transition-all duration-150 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl ${
                expanded ? 'w-full px-3 py-2 gap-3' : 'justify-center w-10 h-10'
              }`}
            >
              <span className="shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-150 ${expanded ? 'opacity-100 max-w-[200px]' : 'max-w-0 opacity-0'}`}>
                Logout
              </span>
            </button>
            {!expanded && (
              <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                  <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">Logout</span>
                </div>
              </div>
            )}
          </div>

          {/* Shortcuts */}
          <div className={`relative flex w-full ${expanded ? '' : 'justify-center group'}`}>
            <button
              onClick={() => setShowShortcuts(true)}
              className={`flex items-center transition-all duration-150 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl ${
                expanded ? 'w-full px-3 py-2 gap-3' : 'justify-center w-10 h-10'
              }`}
            >
              <span className="shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-150 ${expanded ? 'opacity-100 max-w-[200px]' : 'max-w-0 opacity-0'}`}>
                Shortcuts
              </span>
            </button>
            {!expanded && (
              <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                  <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">Keyboard shortcuts</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* ── Mobile: Floating Action Button ── */}
      <div className="md:hidden fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Speed-dial items (visible when open) */}
        {fabOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[-1]"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
              onClick={() => setFabOpen(false)}
            />
            {/* Scrollable items panel — top→bottom order, capped so it never overflows screen */}
            <div className="flex flex-col items-end gap-3 overflow-y-auto scrollbar-hide max-h-[calc(100dvh-140px)] pt-1">
              {/* Nav items in natural order — first item at top, scroll down for more */}
              {visibleNav.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3"
                  style={{ animation: `fabItemIn 0.15s ease-out ${idx * 0.03}s both` }}
                >
                  <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                    {item.label}
                  </span>
                  <Link
                    href={item.href}
                    onClick={() => setFabOpen(false)}
                    className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
                      isActive(item.href) ? 'text-white' : 'bg-white text-gray-600'
                    }`}
                    style={isActive(item.href) ? { backgroundColor: primaryColor } : {}}
                  >
                    {item.icon}
                  </Link>
                </div>
              ))}
              {/* Logout at the bottom */}
              <div
                className="flex items-center gap-3"
                style={{ animation: `fabItemIn 0.15s ease-out ${visibleNav.length * 0.03}s both` }}
              >
                <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                  Logout
                </span>
                <button
                  onClick={() => { setFabOpen(false); handleLogout(); }}
                  className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg bg-red-50 text-red-500 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setFabOpen(prev => !prev)}
          className="flex items-center justify-center w-14 h-14 rounded-full shadow-xl text-white transition-all active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          {fabOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Shortcuts modal ── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 4a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Shortcuts list */}
            <div className="px-5 py-4 space-y-1">
              {[
                { keys: ['Ctrl', 'K'], label: 'Open command palette / search', category: 'Navigation' },
                { keys: ['Alt', 'N'],  label: 'Go to POS — new transaction',   category: 'Navigation' },
                { keys: ['Esc'],       label: 'Go back to previous page',       category: 'Navigation' },
                { keys: ['↑', '↓'],   label: 'Move through palette results',   category: 'Palette' },
                { keys: ['↵'],         label: 'Navigate to selected page',      category: 'Palette' },
                { keys: ['Esc'],       label: 'Close palette',                  category: 'Palette' },
              ].reduce<{ category: string; items: { keys: string[]; label: string; category: string }[] }[]>((acc, s, i, arr) => {
                if (i === 0 || arr[i - 1].category !== s.category)
                  acc.push({ category: s.category, items: [] });
                acc[acc.length - 1].items.push(s);
                return acc;
              }, []).map(group => (
                <div key={group.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 mt-3 first:mt-0">{group.category}</p>
                  {group.items.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600">{s.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        {s.keys.map((k, ki) => (
                          <kbd key={ki} className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">Click anywhere outside to close</p>
            </div>
          </div>
        </div>
      )}

      {/* FAB animation keyframes */}
      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0)   scale(1);   }
        }
      `}</style>
    </>
  );
}
