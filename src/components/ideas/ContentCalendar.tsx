'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarArrowDown, ChevronLeft, ChevronRight, Copy, GripVertical, PenLine, Plus, Send } from 'lucide-react';
import { PublishModal, QUEUE_URL, type Queue } from '@/components/publish/PublishModal';
import type { PostView } from '@/services/publish';
import { refreshJson } from '@/lib/useCachedJson';
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
  const [publishing, setPublishing] = useState<{ idea: SavedIdea; at: Date } | null>(null);
  // Calendar entries that go out on their own, from the posting queue
  const { data: queue } = useCachedJson<Queue | null>(QUEUE_URL);
  const auto = useMemo(() => new Map((queue?.posts ?? []).filter((p) => p.ideaId && (p.status === 'scheduled' || p.status === 'processing' || p.status === 'failed')).map((p) => [p.ideaId!, p])), [queue]);

  const planSlots = useMemo<Slot[]>(() => (planData?.plan?.schedule ?? [])
    .map((s) => ({ weekday: weekdayIndex(s.day), time: parseTime(s.time), label: s.time, format: s.format, why: s.why }))
    .filter((s) => s.weekday >= 0), [planData]);
  // No game plan yet: fall back to the weekdays and hours your own posts did best on
  const slots = useMemo(() => (planSlots.length ? planSlots : bestSlots(posts ?? [])), [planSlots, posts]);
  const fromPlan = planSlots.length > 0;

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

  // The next 14 days: slot days with nothing planned and nothing posted
  const gaps = useMemo(() => {
    if (ideas === undefined || posts === undefined) return [];
    const start = new Date(`${today}T00:00:00`);
    const out: { day: Date; slot: Slot }[] = [];
    for (let i = 0; i < 14; i++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const slot = slots.find((s) => s.weekday === (day.getDay() + 6) % 7);
      const cell = byDay.get(dayKey(day));
      if (!slot || cell?.planned.length || cell?.posted.length) continue;
      // Today only counts while the slot's hour is still ahead
      if (i === 0 && atTime(day, slot.time).getTime() < nowMs()) continue;
      out.push({ day, slot });
    }
    return out;
  }, [ideas, posts, slots, byDay, today]);

  const schedule = async (id: string, at: Date | null) => {
    const res = await fetch(`${SAVED_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(at ? { scheduledFor: at.toISOString() } : { scheduledFor: null, status: 'idea' }),
    });
    if (!res.ok) toast.error('Could not move that idea', { description: ((await res.json().catch(() => ({}))) as { error?: string }).error });
    await refresh();
    // Moving or unscheduling an entry moves or cancels the post waiting on it
    refreshJson(QUEUE_URL);
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
      {!loading && slots.length > 0 && (
        <section className="lg:col-span-2 rounded-[30px] bg-card border border-ink/[0.05] p-4 sm:p-5 flex flex-col gap-3 min-w-0" aria-label="Open slots">
          <div>
            <h2 className="font-bold">{gaps.length ? `${gaps.length} open ${gaps.length === 1 ? 'slot' : 'slots'} in the next two weeks` : 'The next two weeks are covered'}</h2>
            <p className="text-[12px] text-muted-foreground">{fromPlan ? 'Days from your game plan with nothing planned yet.' : 'Your best days and hours so far, worked out from your own posts, with nothing planned yet.'} {gaps.length > 0 && 'Tap one to fill it.'}</p>
          </div>
          {gaps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gaps.map(({ day, slot }) => (
                <button key={dayKey(day)} type="button" onClick={() => setFilling({ day, slot })} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-dashed border-ink/[0.2] text-[13px] font-bold hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="font-normal text-muted-foreground">{formatLabel(slot.format)} · {slot.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
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
                      title={`${i.title} · ${timeLabel(at)}${auto.has(i.id) ? ' · posts automatically' : ''}`}
                      aria-label={`${i.title}, ${timeLabel(at)}`}
                      className={cn('text-left truncate text-[10px] sm:text-[11px] h-1.5 sm:h-auto sm:px-1.5 sm:py-0.5 rounded-md font-semibold cursor-grab active:cursor-grabbing', late ? 'bg-amber-400 sm:bg-amber-500/10 text-amber-400' : 'bg-indigo-400 sm:bg-indigo-500/15 text-indigo-300')}
                    >
                      <span className="hidden sm:inline">{auto.has(i.id) && <Send className={cn('inline w-3 h-3 mr-1 -mt-0.5', auto.get(i.id)!.status === 'failed' && 'text-rose-400')} aria-label="posts automatically" />}<span className="opacity-70">{timeLabel(at)} </span>{i.title}</span>
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
                    <span className="text-[13px] font-semibold leading-snug">{auto.has(i.id) && <Send className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-indigo-300" aria-label="posts automatically" />}{i.title}</span>
                  </button>
                </li>
              );
            })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400 mr-1" />Posted (views)</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 mr-1" />Planned</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-1" />Planned but the day passed</span>
          {fromPlan ? <span>Dashed: open slots from your game plan</span> : slots.length > 0 ? <span>Dashed: your best days so far. <Link href="/recommendations" className="underline">Build a game plan</Link> for a fuller schedule</span> : <Link href="/recommendations" className="underline">Build a game plan to see suggested slots</Link>}
        </div>
      </section>

      <aside className="rounded-[30px] bg-card border border-ink/[0.05] p-4 sm:p-5 space-y-3 self-start lg:sticky lg:top-24">
        <div>
          <h3 className="font-bold">Not scheduled yet</h3>
          <p className="text-[12px] text-muted-foreground"><span className="hidden sm:inline">Drag onto a day, or click to pick a date.</span><span className="sm:hidden">Tap one to pick its date.</span></p>
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
                    <span className="text-[13px] font-semibold leading-snug line-clamp-2">{i.title}</span>
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
          auto={auto.get(editing.idea.id) ?? null}
          onPost={() => {
            setPublishing(editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
          onSave={async (at) => {
            setEditing(null);
            await schedule(editing.idea.id, at);
          }}
        />
      )}
      {publishing && (
        <PublishModal
          ideaId={publishing.idea.id}
          caption={publishing.idea.drafts?.caption ?? ''}
          when={publishing.at}
          kind={publishing.idea.format === 'reel' ? 'reel' : publishing.idea.format === 'carousel' ? 'carousel' : publishing.idea.format === 'story' ? 'story' : 'image'}
          title={publishing.idea.title.slice(0, 80)}
          onClose={() => {
            setPublishing(null);
            refreshJson(QUEUE_URL);
            refreshJson(SAVED_URL);
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

// Without a game plan: the three weekdays your posts did best on, each at the hour you most often posted then.
// Needs at least 8 posts and 2 on a weekday before that weekday counts.
function bestSlots(posts: Post[]): Slot[] {
  if (posts.length < 8) return [];
  const mid = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const overall = mid(posts.map((p) => p.views)) || 1;
  const days = new Map<number, Post[]>();
  for (const p of posts) {
    const w = (new Date(p.publishedAt).getDay() + 6) % 7;
    days.set(w, [...(days.get(w) ?? []), p]);
  }
  return [...days]
    .filter(([, list]) => list.length >= 2)
    .map(([weekday, list]) => ({ weekday, list, views: mid(list.map((p) => p.views)) }))
    // Only days that really do better than usual: a below average day is not a "best day"
    .filter((d) => d.views >= overall)
    .sort((a, b) => b.views - a.views)
    .slice(0, 3)
    .map(({ weekday, list, views }) => {
      const hours = new Map<number, number>();
      for (const p of list) hours.set(new Date(p.publishedAt).getHours(), (hours.get(new Date(p.publishedAt).getHours()) ?? 0) + 1);
      const hour = [...hours].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      const types = new Map<string, number>();
      for (const p of list) types.set(p.type, (types.get(p.type) ?? 0) + 1);
      const lift = Math.round((views / overall - 1) * 100);
      return {
        weekday,
        time: [hour, 0] as [number, number],
        label: `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`,
        format: [...types].sort((a, b) => b[1] - a[1])[0][0],
        why: lift > 0 ? `Your ${WEEKDAYS[weekday]} posts get ${lift}% more views than your usual (${list.length} posts).` : `Your ${WEEKDAYS[weekday]} posts do as well as any day (${list.length} posts).`,
      };
    });
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

function EditModal({ idea, at, auto, onPost, onClose, onSave }: { idea: SavedIdea; at: Date; auto: PostView | null; onPost: () => void; onClose: () => void; onSave: (at: Date | null) => void }) {
  const [value, setValue] = useState(localInput(at));
  return (
    <Modal open onClose={onClose} title={idea.scheduledFor ? 'Move this post' : 'Schedule this idea'} subtitle={idea.title}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Date and time</span>
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-border bg-background/60 px-3 text-sm focus:outline-none focus:border-indigo-500" />
        </label>
        {idea.notes && <p className="text-[12px] text-muted-foreground whitespace-pre-wrap line-clamp-4">{idea.notes}</p>}
        {auto ? (
          <p className={cn('text-[13px] font-semibold rounded-xl px-3 py-2.5 border', auto.status === 'failed' ? 'text-rose-400 bg-rose-500/10 border-rose-500/25' : 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25')}>
            {auto.status === 'failed' ? `Posting failed: ${auto.error ?? 'Instagram did not accept it.'} Retry it from the queue on Create, Calendar.` : 'Posts automatically at this time. Moving it here moves the post; Unschedule cancels it.'}
          </p>
        ) : (
          <button type="button" onClick={onPost} className="self-start inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink text-background text-[13px] font-bold"><Send className="w-3.5 h-3.5" /> Post it, with photos or video</button>
        )}
        {idea.drafts?.caption ? (
          <div className="rounded-2xl bg-ink/[0.04] border border-ink/[0.08] p-3 flex flex-col gap-2">
            <p className="text-[12px] font-bold text-muted-foreground">Caption, ready to paste</p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{idea.drafts.caption}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(idea.drafts!.caption!).then(() => toast.success('Caption copied'), () => toast.error('Could not copy', { description: 'Select the text instead.' }))}
              className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12px] font-bold hover:bg-ink/[0.12]"
            >
              <Copy className="w-3.5 h-3.5" /> Copy caption
            </button>
          </div>
        ) : (
          <Link href={`/create?topic=${encodeURIComponent(idea.title)}`} className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12px] font-bold hover:bg-ink/[0.12]"><PenLine className="w-3.5 h-3.5" /> Write the caption with Sage</Link>
        )}
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
