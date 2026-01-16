'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    // Check authentication on app startup
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}
