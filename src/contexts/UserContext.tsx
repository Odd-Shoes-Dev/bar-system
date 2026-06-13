'use client';

import { createContext, useContext, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  bar_id: string;
  branch_id: string | null;   // null = owner viewing all branches
  branch_name: string | null;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
});

interface UserProviderProps {
  children: ReactNode;
  initialUser: User | null;
}

export function UserProvider({ children, initialUser }: UserProviderProps) {
  return (
    <UserContext.Provider value={{ user: initialUser, loading: false }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}

export function usePermission(action: string): boolean {
  const { user } = useUser();
  if (!user) return false;

  const permissions: Record<string, string[]> = {
    'manage_users':    ['owner', 'admin'],
    'manage_services': ['owner', 'admin', 'manager'],
    'manage_clients':  ['owner', 'admin', 'manager'],
    'view_reports':    ['owner', 'admin', 'manager', 'viewer'],
    'use_pos':         ['owner', 'admin', 'manager', 'cashier'],
    'manage_branches': ['owner'],
  };

  return permissions[action]?.includes(user.role) || false;
}
