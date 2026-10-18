'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarArrowDown, ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { formatLabel } from '@/lib/platform';
import { Modal } from '@/components/ui/modal';
import { formatNumber } from '@/utils/formatters';
import { WEEKDAYS, atTime, buildIcs, dayKey, monthGrid, nowMs, parseTime, thisMonth, todayKey, weekdayIndex } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { SAVED_URL, type SavedIdea } from './saveIdea';
import type { GamePlan } from '@/services/ai';
import type { Post } from '@/types';

type Slot = { weekday: number; time: [number, number] | null; label: string; format: string; why: string };

const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// Value for <input type="datetime-local"> in local time
const localInput = (d: Date) => `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Month view of what went out, what is planned, and the open slots from the game plan.
// Drag an idea onto a day to plan it; drag a planned one to move it.
export function ContentCalendar() {
  const { t } = usePlatform();
  const { data: ideas, refresh } = useCachedJson<SavedIdea[]>(SAVED_URL);
  const { data: posts } = useCachedJson<Post[]>('/api/posts');
  const { data: planData } = useCachedJson<{ plan: GamePlan } | null>('/api/ai/plan');
  const [month, setMonth] = useState(thisMonth);
  const [today] = useState(todayKey);
  const [editing, setEditing] = useState<{ idea: SavedIdea; at: Date } | null>(null);
  const [filling, setFilling] = useState<{ day: Date; slot: Slot } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const slots = useMemo<Slot[]>(() => (planData?.plan?.schedule ?? [])
    .map((s) => ({ weekday: weekdayIndex(s.day), time: parseTime(s.time), label: s.time, format: s.format, why: s.why }))
    .filter((s) => s.weekday >= 0), [planData]);

  const days = useMemo(() => monthGrid(month), [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, { planned: SavedIdea[]; posted: Post[] }>();
    const cell = (k: string) => map.get(k) ?? map.set(k, { planned: [], posted: [] }).get(k)!;
    for (const i of ideas ?? []) if (i.scheduledFor && i.status !== 'posted') cell(dayKey(new Date(i.scheduledFor))).planned.push(i);
    for (const p of posts ?? []) cell(dayKey(new Date(p.publishedAt))).posted.push(p);
    for (const v of map.values()) v.planned.sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!));
    return map;
  }, [ideas, posts]);

  const unscheduled = (ideas ?? []).filter((i) => i.status !== 'posted' && !i.scheduledFor);

  const schedule = async (id: string, at: Date | null) => {
    const res = await fetch(`${SAVED_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(at ? { scheduledFor: at.toISOString() } : { scheduledFor: null, status: 'idea' }),
    });
    if (!res.ok) toast.error('Could not move that idea');
    await refresh();
  };

  // Dropping keeps a planned idea's time; a fresh idea takes that weekday's plan slot, or 6 PM
  const dropOn = (day: Date, id: string) => {
    const idea = ideas?.find((i) => i.id === id);
    if (!idea) return;
    const prev = idea.scheduledFor ? new Date(idea.scheduledFor) : null;
    const slot = slots.find((s) => s.weekday === (day.getDay() + 6) % 7);
    const at = prev ? atTime(day, [prev.getHours(), prev.getMinutes()]) : atTime(day, slot?.time ?? null);
    void schedule(id, at);
  };

  const exportIcs = () => {
    const now = nowMs();
    const events = (ideas ?? [])
      .filter((i) => i.scheduledFor && i.status !== 'posted' && Date.parse(i.scheduledFor) > now - 86_400_000)
      .map((i) => ({ id: i.id, title: i.title, start: new Date(i.scheduledFor!), notes: [i.format ? formatLabel(i.format) : '', i.notes, i.drafts?.caption ?? ''].filter(Boolean).join('\n\n'), url: `${location.origin}/recommendations?tab=board` }));
    if (!events.length) return toast.error('Nothing planned yet', { description: 'Drag an idea onto a day first.' });
    const url = URL.createObjectURL(new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instasage-posts.ics';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${events.length} planned ${events.length === 1 ? t.post : t.posts} exported`, { description: 'Open the file to add them to Google, Apple or Outlook calendar, with a reminder 30 minutes before.' });
  };

  const loading = ideas === undefined || posts === undefined;
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-4">
      <section className="rounded-[30px] bg-card border border-ink/[0.05] p-3 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-lg font-bold mr-auto">{monthLabel}</h2>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" className="p-2 rounded-full hover:bg-ink/[0.06]"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => setMonth(thisMonth())} className="h-8 px-3 rounded-full bg-ink/[0.06] text-[12px] font-bold hover:bg-ink/[0.1]">Today</button>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" className="p-2 rounded-full hover:bg-ink/[0.06]"><ChevronRight className="w-4 h-4" /></button>
          <button type="button" onClick={exportIcs} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12px] font-bold hover:bg-ink/[0.12]"><CalendarArrowDown className="w-3.5 h-3.5" /> .ics</button>
        </div>

        <div className={cn('grid grid-cols-7 gap-1 transition-opacity', loading && 'opacity-50')}>
          {WEEKDAYS.map((w) => <p key={w} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center pb-1">{w}</p>)}
          {days.map((day) => {
            const key = dayKey(day);
            const cell = byDay.get(key);
            const inMonth = day.getMonth() === month.getMonth();
            const future = key >= today;
            const slot = future && !cell?.planned.length ? slots.find((s) => s.weekday === (day.getDay() + 6) % 7) : undefined;
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over !== key) setOver(key);
                }}
                onDragLeave={() => over === key && setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData('text/idea');
                  if (id) dropOn(day, id);
                }}
                data-day={key}
                className={cn(
                  'min-h-[76px] sm:min-h-[104px] rounded-xl border p-1 sm:p-1.5 flex flex-col gap-1 min-w-0 transition-colors',
                  inMonth ? 'bg-ink/[0.02] border-ink/[0.05]' : 'border-transparent opacity-45',
                  over === key && 'border-indigo-400 bg-indigo-500/10',
                )}
              >
                <span className={cn('text-[11px] font-bold tabular-nums self-start px-1.5 rounded-full', key === today ? 'bg-ink text-background' : 'text-muted-foreground')}>{day.getDate()}</span>
                {cell?.posted.slice(0, 2).map((p) => (
                  <Link key={p.id} href={`/content/${encodeURIComponent(p.id)}`} title={p.caption} aria-label={`${formatLabel(p.type)}, ${formatNumber(p.views)} views`} className="block truncate text-[10px] sm:text-[11px] h-1.5 sm:h-auto sm:px-1.5 sm:py-0.5 rounded-md bg-emerald-400 sm:bg-emerald-500/10 text-emerald-400 font-semibold">
                    <span className="hidden sm:inline">{formatLabel(p.type)} · {formatNumber(p.views)}</span>
                  </Link>
                ))}
                {(cell?.posted.length ?? 0) > 2 && <span className="text-[10px] text-muted-foreground px-1">+{cell!.posted.length - 2} more</span>}
                {cell?.planned.map((i) => {
                  const at = new Date(i.scheduledFor!);
                  const late = !future;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/idea', i.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => setEditing({ idea: i, at })}
                      title={`${i.title} · ${timeLabel(at)}`}
                      aria-label={`${i.title}, ${timeLabel(at)}`}
                      className={cn('text-left truncate text-[10px] sm:text-[11px] h-1.5 sm:h-auto sm:px-1.5 sm:py-0.5 rounded-md font-semibold cursor-grab active:cursor-grabbing', late ? 'bg-amber-400 sm:bg-amber-500/10 text-amber-400' : 'bg-indigo-400 sm:bg-indigo-500/15 text-indigo-300')}
                    >
                      <span className="hidden sm:inline"><span className="opacity-70">{timeLabel(at)} </span>{i.title}</span>
                    </button>
                  );
                })}
                {slot && inMonth && (
                  <button type="button" onClick={() => setFilling({ day, slot })} title={`Plan slot: ${slot.format} at ${slot.label}. ${slot.why}`} className="hidden sm:block text-left truncate text-[10px] px-1.5 py-0.5 rounded-md border border-dashed border-ink/[0.15] text-muted-foreground hover:text-foreground hover:border-ink/[0.3]">
                    + {formatLabel(slot.format)} {slot.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {/* Phones: the cells only show coloured bars, so list this month's plans underneath */}
        <ul className="sm:hidden mt-3 space-y-1.5">
          {(ideas ?? [])
            .filter((i) => i.scheduledFor && i.status !== 'posted' && new Date(i.scheduledFor).getMonth() === month.getMonth() && new Date(i.scheduledFor).getFullYear() === month.getFullYear())
            .sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!))
            .map((i) => {
              const at = new Date(i.scheduledFor!);
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => setEditing({ idea: i, at })} className="w-full flex items-center gap-3 text-left p-2.5 rounded-xl bg-ink/[0.03] border border-ink/[0.06]">
                    <span className="text-[11px] font-bold text-indigo-300 w-14 shrink-0">{at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}<br /><span className="font-normal text-muted-foreground">{timeLabel(at)}</span></span>
                    <span className="text-[13px] font-semibold leading-snug">{i.title}</span>
                  </button>
                </li>
              );
            })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400 mr-1" />Posted (views)</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 mr-1" />Planned</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-1" />Planned but the day passed</span>
          {slots.length > 0 ? <span>Dashed: open slots from your game plan</span> : <Link href="/recommendations" className="underline">Build a game plan to see suggested slots</Link>}
        </div>
      </section>

      <aside className="rounded-[30px] bg-card border border-ink/[0.05] p-4 sm:p-5 space-y-3 self-start lg:sticky lg:top-24">
        <div>
          <h3 className="font-bold">Not scheduled yet</h3>
          <p className="text-[12px] text-muted-foreground">Drag onto a day, or tap to pick a date.</p>
        </div>
        {unscheduled.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Everything is scheduled. <Link href="/recommendations?tab=brainstorm" className="underline">Get more ideas</Link></p>
        ) : (
          <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {unscheduled.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/idea', i.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => setEditing({ idea: i, at: nextSlot(slots) })}
                  className="w-full flex items-start gap-2 text-left p-2.5 rounded-xl bg-ink/[0.03] border border-ink/[0.06] hover:bg-ink/[0.06] cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug line-clamp-2">{i.title}</span>
                    {i.format && <span className="text-[11px] text-muted-foreground">{formatLabel(i.format)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {editing && (
        <EditModal
          key={editing.idea.id}
          idea={editing.idea}
          at={editing.at}
          onClose={() => setEditing(null)}
          onSave={async (at) => {
            setEditing(null);
            await schedule(editing.idea.id, at);
          }}
        />
      )}
      {filling && (
        <FillSlotModal
          day={filling.day}
          slot={filling.slot}
          ideas={unscheduled}
          onClose={() => setFilling(null)}
          onPick={async (id, title) => {
            const at = atTime(filling.day, filling.slot.time);
            setFilling(null);
            if (id) return schedule(id, at);
            const res = await fetch(SAVED_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, format: filling.slot.format, source: 'plan', scheduledFor: at.toISOString() }) });
            if (!res.ok) toast.error('Could not add that idea');
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// Tomorrow at the first plan slot time (or 6 PM), as a starting point in the date picker
function nextSlot(slots: Slot[]) {
  const tomorrow = new Date(nowMs() + 86_400_000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + i);
    const s = slots.find((x) => x.weekday === (d.getDay() + 6) % 7);
    if (s) return atTime(d, s.time);
  }
  return atTime(tomorrow, null);
}

function EditModal({ idea, at, onClose, onSave }: { idea: SavedIdea; at: Date; onClose: () => void; onSave: (at: Date | null) => void }) {
  const [value, setValue] = useState(localInput(at));
  return (
    <Modal open onClose={onClose} title={idea.scheduledFor ? 'Move this post' : 'Schedule this idea'} subtitle={idea.title}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Date and time</span>
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-border bg-background/60 px-3 text-sm focus:outline-none focus:border-indigo-500" />
        </label>
        {idea.notes && <p className="text-[12px] text-muted-foreground whitespace-pre-wrap line-clamp-4">{idea.notes}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!value} onClick={() => onSave(new Date(value))} className="h-10 px-5 rounded-full bg-ink text-background text-sm font-bold disabled:opacity-50">Save</button>
          {idea.scheduledFor && <button type="button" onClick={() => onSave(null)} className="h-10 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-sm font-bold">Unschedule</button>}
          <Link href="/recommendations?tab=board" className="h-10 px-4 inline-flex items-center rounded-full text-sm font-bold text-muted-foreground hover:text-foreground">Open in idea board</Link>
        </div>
      </div>
    </Modal>
  );
}

function FillSlotModal({ day, slot, ideas, onClose, onPick }: { day: Date; slot: Slot; ideas: SavedIdea[]; onClose: () => void; onPick: (id: string | null, title?: string) => void }) {
  const [title, setTitle] = useState('');
  const sorted = [...ideas].sort((a, b) => Number(b.format === slot.format) - Number(a.format === slot.format));
  return (
    <Modal open onClose={onClose} title={`${formatLabel(slot.format)} slot, ${day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} at ${slot.label}`} subtitle={slot.why}>
      <div className="space-y-3">
        {sorted.length > 0 && (
          <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {sorted.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => onPick(i.id)} className="w-full text-left p-3 rounded-xl bg-ink/[0.03] border border-ink/[0.06] hover:bg-ink/[0.07]">
                  <span className="block text-sm font-semibold">{i.title}</span>
                  {i.format && <span className={cn('text-[11px]', i.format === slot.format ? 'text-emerald-400' : 'text-muted-foreground')}>{formatLabel(i.format)}{i.format === slot.format ? ' · fits this slot' : ''}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onPick(null, title.trim());
          }}
          className="flex gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Or type a new idea" maxLength={200} className="flex-1 h-11 rounded-xl border border-border bg-background/60 px-3 text-sm focus:outline-none focus:border-indigo-500" />
          <button type="submit" disabled={!title.trim()} className="h-11 px-4 inline-flex items-center gap-1.5 rounded-xl bg-ink text-background text-sm font-bold disabled:opacity-50"><Plus className="w-4 h-4" /> Add</button>
        </form>
      </div>
    </Modal>
  );
}
