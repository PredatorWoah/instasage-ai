'use client';

import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

const CLASSES = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', 'page-fade': 'page-fade', default: 'page-fade' };

// Keyed by path so each navigation is a real exit + enter: the old page leaves, the new one arrives
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={CLASSES} exit={CLASSES} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
