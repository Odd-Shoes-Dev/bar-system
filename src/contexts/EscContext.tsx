'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

interface EscContextType {
  push: (fn: () => void) => void;
  pop:  () => void;
  trigger: () => boolean;
}

const EscContext = createContext<EscContextType>({
  push:    () => {},
  pop:     () => {},
  trigger: () => false,
});

export function EscProvider({ children }: { children: React.ReactNode }) {
  const stack = useRef<(() => void)[]>([]);

  const push = useCallback((fn: () => void) => {
    stack.current = [...stack.current, fn];
  }, []);

  const pop = useCallback(() => {
    stack.current = stack.current.slice(0, -1);
  }, []);

  const trigger = useCallback((): boolean => {
    if (stack.current.length === 0) return false;
    const top = stack.current[stack.current.length - 1];
    top();
    return true;
  }, []);

  return (
    <EscContext.Provider value={{ push, pop, trigger }}>
      {children}
    </EscContext.Provider>
  );
}

export const useEsc = () => useContext(EscContext);

export function useModalEsc(isOpen: boolean, closeModal: () => void) {
  const { push, pop } = useEsc();

  useEffect(() => {
    if (!isOpen) return;
    push(closeModal);
    return () => pop();
  }, [isOpen, closeModal, push, pop]);
}
