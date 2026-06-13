'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextValue {
  expanded: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({ expanded: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved === 'false') setExpanded(false);
  }, []);

  const toggle = () => {
    setExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_expanded', String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ expanded, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
