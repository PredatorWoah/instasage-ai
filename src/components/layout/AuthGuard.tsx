'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check if user session exists in localStorage
    const session = localStorage.getItem('instasage_session');
    
    // Whitelist auth routes (login, register, forgot-password)
    const isAuthRoute = ['/login', '/register', '/forgot-password'].includes(pathname);

    if (!session && !isAuthRoute) {
      setAuthorized(false);
      router.replace('/login');
    } else if (session && isAuthRoute) {
      router.replace('/');
    } else {
      setAuthorized(true);
    }
  }, [router, pathname]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
