'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell, Flame, Swords, TrendingDown, Trophy, Clock3, X } from 'lucide-react';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';
import { cn } from '@/lib/utils';
import type { Alert } from '@/services/alerts';

const ICON: Record<Alert['kind'], React.ElementType> = { outperforming: Flame, cadence: Clock3, milestone: Trophy, follower_drop: TrendingDown, rival_viral: Swords };
const TONE: Record<Alert['tone'], string> = { good: 'bg-emerald-500/15 text-emerald-400', warn: 'bg-amber-500/15 text-amber-400', info: 'bg-indigo-500/15 text-indigo-300' };
const URL_ = '/api/alerts';

const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
};

// Bell with a count; opens a frosted panel of what needs attention
export function AlertsBell() {
  const router = useRouter();
  const { data } = useCachedJson<{ alerts: Alert[] }>(URL_);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Alert[] | null>(null);
  const alerts = list ?? data?.alerts ?? [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = async (id: string) => {
    const next = id === 'all' ? [] : alerts.filter((a) => a.id !== id);
    setList(next);
    primeJson(URL_, { alerts: next });
    await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismiss: id }) });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={alerts.length ? `${alerts.length} alerts` : 'Alerts'}
        aria-expanded={open}
        className="relative w-11 h-11 rounded-full bg-card border border-ink/[0.06] flex items-center justify-center hover:bg-secondary shrink-0"
      >
        <Bell className="w-[18px] h-[18px]" />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF5F8F] text-white text-[10px] font-extrabold flex items-center justify-center">{alerts.length}</span>
        )}
      </button>
      {open && createPortal(
        <>
          <button type="button" aria-label="Close alerts" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/30" />
          <div role="dialog" aria-label="Alerts" className="acrylic-panel fixed z-50 right-3 left-3 sm:left-auto top-[80px] sm:w-[400px] max-h-[70vh] overflow-y-auto rounded-[26px] p-3 animate-[drop-in_260ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <p className="font-bold">Alerts</p>
              {alerts.length > 1 && <button onClick={() => dismiss('all')} className="text-[12px] font-bold text-muted-foreground hover:text-foreground">Clear all</button>}
            </div>
            {alerts.length === 0 ? (
              <p className="px-2 pb-3 text-sm text-muted-foreground">All quiet. You&apos;ll see posts taking off, milestones, posting gaps and rivals going viral here.</p>
            ) : (
              <ul className="space-y-1.5">
                {alerts.map((a) => {
                  const Icon = ICON[a.kind];
                  return (
                    <li key={a.id} className="group flex gap-3 p-2.5 rounded-2xl hover:bg-ink/[0.05]">
                      <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', TONE[a.tone])}><Icon className="w-4 h-4" /></span>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setOpen(false);
                          if (a.href) router.push(a.href);
                        }}
                      >
                        <span className="block text-[13px] font-bold leading-snug">{a.title}</span>
                        <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{a.body}</span>
                        <span className="block text-[10px] text-muted-foreground mt-1">{ago(a.at)}</span>
                      </button>
                      <button type="button" onClick={() => dismiss(a.id)} className="p-1 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-ink/[0.08] shrink-0" aria-label="Dismiss alert"><X className="w-3.5 h-3.5" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
