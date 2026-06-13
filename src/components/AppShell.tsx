'use client';

import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/';
  const { expanded } = useSidebar();

  return (
    <div className={isAuthPage ? '' : `transition-all duration-200 ${expanded ? 'md:pl-[208px]' : 'md:pl-16'}`}>
      {children}
    </div>
  );
}
