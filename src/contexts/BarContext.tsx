'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Bar } from '@/types';

interface BarContextType {
  bar: Bar | null;
  loading: boolean;
}

const BarContext = createContext<BarContextType>({
  bar: null,
  loading: true,
});

interface BarProviderProps {
  children: ReactNode;
  initialBar: Bar | null;
}

export function BarProvider({ children, initialBar }: BarProviderProps) {
  return (
    <BarContext.Provider value={{ bar: initialBar, loading: false }}>
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  const context = useContext(BarContext);
  if (!context) {
    throw new Error('useBar must be used within BarProvider');
  }
  return context;
}

export function useBrandColors() {
  const { bar } = useBar();
  return {
    primary: bar?.theme_primary_color || '#2563EB',
    secondary: bar?.theme_secondary_color || '#F59E0B',
  };
}
