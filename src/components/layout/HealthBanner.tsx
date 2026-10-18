'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TriangleAlert, X } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { STATUS_CHANGED, STATUS_URL, type AccountHealth, type AppStatus } from '@/lib/status';

function message(a: AccountHealth) {
  const who = `@${a.username}`;
  if (a.problems.includes('disconnected') || a.problems.includes('token_expired')) {
    return { text: `${who} is disconnected, so its numbers have stopped updating.`, action: a.platform === 'instagram' ? 'Reconnect' : 'Open Accounts', href: a.platform === 'instagram' ? '/api/connect/instagram' : '/accounts' };
  }
  if (a.problems.includes('sync_failed')) {
    return { text: `The last sync of ${who} failed${a.lastJob?.error ? `: ${a.lastJob.error.slice(0, 120)}` : '.'}`, action: 'Open Accounts', href: '/accounts' };
  }
  const days = a.tokenExpiresAt ? Math.max(0, Math.round((Date.parse(a.tokenExpiresAt) - Date.now()) / 86_400_000)) : 0;
  return { text: `Instagram access for ${who} runs out in ${days} day${days === 1 ? '' : 's'}. A sync renews it.`, action: 'Open Accounts', href: '/accounts' };
}

// A quiet strip under the header when an account needs attention; hidden for the session once closed
export function HealthBanner() {
  const { data, refresh } = useCachedJson<AppStatus>(STATUS_URL);
  useEffect(() => {
    const onChange = () => { refresh(); };
    window.addEventListener(STATUS_CHANGED, onChange);
    return () => window.removeEventListener(STATUS_CHANGED, onChange);
  }, [refresh]);
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem('health-banner-hidden') === '1';
    } catch {
      return false;
    }
  });
  const problem = data?.accounts.find((a) => a.problems.length > 0);
  if (!problem || hidden) return null;
  const m = message(problem);
  const others = (data?.accounts.filter((a) => a.problems.length > 0).length ?? 1) - 1;

  return (
    <div className="max-w-[1480px] mx-auto px-3 sm:px-6 pt-3">
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-[13px]">
        <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="flex-1 min-w-0">{m.text}{others > 0 ? ` (and ${others} more)` : ''}</p>
        <Link href={m.href} className="shrink-0 font-bold text-amber-300 hover:underline">{m.action}</Link>
        <button
          onClick={() => {
            try { sessionStorage.setItem('health-banner-hidden', '1'); } catch { /* private mode */ }
            setHidden(true);
          }}
          className="p-1 rounded-full hover:bg-white/[0.08] shrink-0"
          aria-label="Hide for now"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
