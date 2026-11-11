'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const KEY = 'instasage:auto-review';

// Once per browser session, a few seconds after the Overview loads, ask the server to review one
// new post. When it did, refresh so the verdict shows on the card. Silent on any failure
export function AutoReview({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/auto-review', { method: 'POST' });
        const body = res.ok ? await res.json() : null;
        if (!cancelled && body?.reviewed) router.refresh();
      } catch {
        // The next visit tries again
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, router]);
  return null;
}
