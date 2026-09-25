'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    const isAuthRoute = ['/login'].includes(pathname);

    if (!session && !isAuthRoute) {
      setAuthorized(false);
      router.replace('/login');
    } else if (session && isAuthRoute) {
      router.replace('/');
    } else {
      setAuthorized(true);
    }
  }, [session, status, router, pathname]);

  if (status === 'loading' || !authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
