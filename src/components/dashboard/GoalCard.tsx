'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flag, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { clearJsonCache } from '@/lib/useCachedJson';
import { STATUS_CHANGED } from '@/lib/status';
import { goalForecast, type Goal, type GoalForecast } from '@/lib/goal';
import { formatNumber } from '@/utils/formatters';

function Ring({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="w-[72px] h-[72px] -rotate-90 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="goalRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B9A" />
          <stop offset="50%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#4ADE9E" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(128,128,160,0.18)" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="url(#goalRing)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

// Follower (or subscriber) goal with a forecast at the current pace
export function GoalCard({ forecast: initial, current, unit, perDay, timeZone }: {
  forecast: GoalForecast | null;
  current: number;
  unit: string;
  perDay: number | null;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // After a save the card works the forecast out itself (same maths as the server), so it updates at
  // once instead of waiting on a page refresh that a background preload can overtake
  const [saved, setSaved] = useState<Goal | null | undefined>(undefined);
  const forecast = saved === undefined ? initial : goalForecast(saved, current, perDay, timeZone);
  const [target, setTarget] = useState(String(forecast?.target ?? (Math.ceil((current * 1.25) / 100) * 100 || 100)));
  const [deadline, setDeadline] = useState(forecast?.deadline?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (goal: { target: number; deadline?: string } | null) => {
    setSaving(true);
    const res = await fetch('/api/user', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast.error('Goal not saved', { description: data.error });
    setOpen(false);
    setSaved(goal);
    toast.success(goal ? 'Goal set' : 'Goal removed');
    clearJsonCache();
    window.dispatchEvent(new Event(STATUS_CHANGED));
    router.refresh();
  };

  return (
    <>
      <div id="goal" className="rounded-[30px] p-5 bg-card border border-ink/[0.05] flex items-center gap-4">
        {forecast ? (
          <>
            <div className="relative">
              <Ring value={forecast.progress} />
              <span className="absolute inset-0 flex items-center justify-center font-display font-extrabold text-[15px]">{Math.round(forecast.progress * 100)}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-muted-foreground flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Goal: {formatNumber(forecast.target)} {forecast.target === 1 ? unit.replace(/s$/, "") : unit}</p>
              {forecast.reached ? (
                <p className="font-display font-extrabold text-[18px] leading-tight mt-0.5">Reached. Time for a bigger one.</p>
              ) : (
                <>
                  <p className="font-display font-extrabold text-[18px] leading-tight mt-0.5">{formatNumber(forecast.remaining)} to go</p>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                    {forecast.eta ? `At ${forecast.perDay}/day you get there around ${forecast.eta}.` : forecast.perDay != null ? 'Not growing at the moment, so no finish date yet.' : 'A few more daily syncs and a forecast appears.'}
                    {forecast.neededPerDay != null && (
                      <span className={forecast.onTrack ? ' text-emerald-400' : ' text-amber-400'}> {forecast.onTrack ? 'On track for' : `Needs ${forecast.neededPerDay}/day for`} {forecast.deadlineLabel}.</span>
                    )}
                  </p>
                </>
              )}
            </div>
            <button onClick={() => setOpen(true)} className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-ink/[0.08] self-start" aria-label="Edit goal"><Pencil className="w-4 h-4" /></button>
          </>
        ) : (
          <>
            <span className="w-12 h-12 rounded-2xl prism-hero flex items-center justify-center shrink-0"><Flag className="w-5 h-5 text-white" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Set a {unit.replace(/s$/, '')} goal</p>
              <p className="text-[12px] text-muted-foreground">See your progress and the date you&apos;ll hit it at your current pace.</p>
            </div>
            <button onClick={() => setOpen(true)} className="h-9 px-4 rounded-full bg-ink text-background text-[13px] font-bold shrink-0">Set goal</button>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Your ${unit} goal`} subtitle={`You have ${formatNumber(current)} ${unit} now.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save({ target: Number(target), ...(deadline ? { deadline } : {}) });
          }}
          className="space-y-3"
        >
          <label className="block text-xs font-medium space-y-1.5">
            <span>Target</span>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} className="w-full h-10 rounded-xl bg-ink/[0.05] border border-ink/[0.1] px-3 text-sm" required />
          </label>
          <label className="block text-xs font-medium space-y-1.5">
            <span>By (optional)</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full h-10 rounded-xl bg-ink/[0.05] border border-ink/[0.1] px-3 text-sm" />
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-full bg-ink text-background text-sm font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Save goal'}</button>
            {forecast && <button type="button" onClick={() => save(null)} disabled={saving} className="h-10 px-4 rounded-full text-sm font-bold text-muted-foreground hover:text-rose-400">Remove</button>}
          </div>
        </form>
      </Modal>
    </>
  );
}
