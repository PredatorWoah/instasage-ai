'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';
import { STATUS_CHANGED, STATUS_URL, type AppStatus } from '@/lib/status';
import { cn } from '@/lib/utils';

const STEPS: { key: keyof AppStatus['setup']['steps']; title: string; hint: string; href: string }[] = [
  { key: 'account', title: 'Connect an account', hint: 'Instagram, YouTube or both', href: '/accounts' },
  { key: 'synced', title: 'Sync your posts', hint: 'Press Sync now above', href: '/accounts' },
  { key: 'ai', title: 'Add an AI key', hint: 'Gemini has a free tier', href: '/settings#ai' },
  { key: 'timezone', title: 'Check your timezone', hint: 'So best times are in your time', href: '/settings#timezone' },
  { key: 'profile', title: 'Fill in your creator profile', hint: 'Niche, voice, goals: better AI advice', href: '/account#creator-profile' },
  { key: 'goal', title: 'Set a follower goal', hint: 'See the date you will hit it', href: '#goal' },
];

// First-run guide on the Overview; disappears once everything is done or it is dismissed
export function SetupChecklist() {
  const { data, refresh } = useCachedJson<AppStatus>(STATUS_URL);
  useEffect(() => {
    const onChange = () => { refresh(); };
    window.addEventListener(STATUS_CHANGED, onChange);
    return () => window.removeEventListener(STATUS_CHANGED, onChange);
  }, [refresh]);
  if (!data || data.setup.dismissed) return null;
  const done = STEPS.filter((s) => data.setup.steps[s.key]).length;
  if (done === STEPS.length) return null;

  const dismiss = async () => {
    primeJson(STATUS_URL, { ...data, setup: { ...data.setup, dismissed: true } });
    await fetch('/api/user', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupDismissed: true }) });
    window.location.reload();
  };

  return (
    <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-4 animate-rise">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Get set up · {done} of {STEPS.length} done</h2>
          <div className="mt-2 h-1.5 w-56 max-w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full prism-hero rounded-full transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <button onClick={dismiss} className="p-2 -m-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label="Hide setup checklist"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {STEPS.map((s) => {
          const ok = data.setup.steps[s.key];
          return (
            <Link key={s.key} href={s.href} className={cn('flex items-center gap-3 p-3 rounded-2xl border transition-colors', ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]')}>
              <span className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.08] text-muted-foreground')}>
                {ok ? <Check className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-current" />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-sm font-bold', ok && 'text-muted-foreground line-through')}>{s.title}</span>
                <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
