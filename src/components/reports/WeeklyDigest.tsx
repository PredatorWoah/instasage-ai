'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, CalendarDays, Send } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatLabel } from '@/lib/platform';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Weekly, WeeklyPost } from '@/services/weekly';

type Data = { digest: Weekly | null; weekly: boolean; email: string; emailReady: boolean };

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatNumber(Math.abs(n))}`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// The last 7 days in a few lines and three things to do next. The same digest goes out every Monday.
export function WeeklyDigest() {
  const { data } = useCachedJson<Data | null>('/api/reports/weekly');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/reports/weekly', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { sent?: boolean; push?: number; email?: string | null; reason?: string | null; error?: string };
      if (res.ok && body.sent) {
        const emailed = body.email?.startsWith('sent');
        toast.success('Digest sent', { description: [body.push ? `To ${body.push} ${body.push === 1 ? 'device' : 'devices'}` : '', emailed ? `Email ${body.email}` : body.email ? `Email not sent: ${body.email}` : ''].filter(Boolean).join('. ') });
      } else toast.error('The digest was not sent', { description: body.error || body.reason || 'Try again.' });
    } catch {
      toast.error('Could not reach the server');
    }
    setSending(false);
  };

  if (data === undefined) return <div className="h-56 rounded-[30px] bg-card animate-pulse" aria-label="Loading the weekly digest" />;
  if (!data?.digest) return null;
  const w = data.digest;
  const shownAccounts = w.accounts.slice(0, 2);
  const where = [data.weekly ? 'push on Mondays' : '', data.weekly && data.email ? (data.emailReady ? `email to ${data.email}` : 'email (not set up yet)') : ''].filter(Boolean).join(' and ');

  return (
    <section className="rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6 flex flex-col gap-4 min-w-0" aria-label="Weekly digest">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Your week</h2>
          <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
            {day(w.from)} to {day(w.to)}. {where ? `Goes out as a ${where}.` : 'The Monday digest is off.'} <Link href="/settings#notifications" className="underline underline-offset-2 hover:text-foreground">Change</Link>
          </p>
        </div>
        <button type="button" onClick={send} disabled={sending} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12.5px] font-bold hover:bg-ink/[0.12] disabled:opacity-50 shrink-0 self-start">
          <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send it to me now'}
        </button>
      </div>

      <div className={cn('grid grid-cols-2 gap-3', shownAccounts.length === 1 ? 'lg:grid-cols-3' : 'lg:grid-cols-4', shownAccounts.length === 1 && '[&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1')}>
        {shownAccounts.map((a) => (
          <Tile key={a.username} label={`@${a.username}`} value={a.change == null ? formatNumber(a.followers) : signed(a.change)} sub={a.change == null ? `${a.platform === 'youtube' ? 'subscribers' : 'followers'}, no reading from a week ago` : `${a.platform === 'youtube' ? 'subscribers' : 'followers'} this week, now ${formatNumber(a.followers)}`} tone={a.change == null ? undefined : a.change >= 0 ? 'up' : 'down'} />
        ))}
        <Tile label="Posts" value={String(w.posts)} sub={`the week before: ${w.postsBefore}`} />
        <Tile label="Views on them" value={formatNumber(w.views)} sub="so far, still climbing" />
      </div>

      {(w.best || w.weakest) && (
        <div className="grid md:grid-cols-2 gap-3">
          {w.best && <PostLine title="Best this week" post={w.best} />}
          {w.weakest && <PostLine title="Lowest this week" post={w.weakest} />}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <div className="rounded-2xl bg-violet-500/[0.08] border border-violet-400/20 p-4 flex flex-col gap-2.5 min-w-0">
          <h3 className="text-sm font-bold">Do these three</h3>
          {w.todo.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing pressing. Keep doing what you are doing.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {w.todo.map((t, i) => (
                <li key={t.text}>
                  <Link href={t.href} className="group flex items-start gap-3 rounded-xl p-2 -m-2 hover:bg-ink/[0.06]">
                    <span className="w-6 h-6 rounded-full bg-ink text-background text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[13.5px] leading-snug min-w-0 break-words flex-1">{t.text}</span>
                    <ArrowRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl bg-ink/[0.03] border border-ink/[0.06] p-4 flex flex-col gap-2.5 min-w-0">
          <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-indigo-400" /> Next 7 days</h3>
          {w.planned.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing on the calendar. <Link href="/recommendations?tab=calendar" className="underline underline-offset-2 hover:text-foreground">Plan a post</Link></p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {w.planned.slice(0, 5).map((p, i) => (
                <li key={i} className="flex gap-3 text-[13.5px] leading-snug min-w-0">
                  <span className="text-muted-foreground shrink-0 w-[92px]">{new Date(p.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="min-w-0 break-words">{p.title}</span>
                </li>
              ))}
              {w.planned.length > 5 && <li className="text-[12px] text-muted-foreground">and {w.planned.length - 5} more</li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-2xl bg-ink/[0.03] border border-ink/[0.06] p-4 min-w-0">
      <p className="text-[12px] font-bold text-muted-foreground truncate">{label}</p>
      <p className={cn('text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] leading-tight mt-1 tabular-nums', tone === 'up' && 'text-emerald-400', tone === 'down' && 'text-rose-400')}>{value}</p>
      <p className="text-[12px] text-muted-foreground leading-snug">{sub}</p>
    </div>
  );
}

function PostLine({ title, post }: { title: string; post: WeeklyPost }) {
  return (
    <Link href={`/content/${encodeURIComponent(post.id)}`} className="rounded-2xl bg-ink/[0.03] border border-ink/[0.06] p-4 flex flex-col gap-1 min-w-0 hover:bg-ink/[0.06] transition-colors">
      <span className="text-[12px] font-bold text-muted-foreground">{title}</span>
      <span className="text-[14.5px] font-semibold leading-snug break-words line-clamp-2">{post.hook}</span>
      <span className="text-[12.5px] text-muted-foreground">
        {formatLabel(post.type)} · {formatNumber(post.views)} views
        {post.vsUsual != null && <> · <span className={cn('font-bold', post.vsUsual >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{post.vsUsual >= 0 ? '+' : '−'}{Math.abs(post.vsUsual)}%</span> against your usual</>}
      </span>
    </Link>
  );
}
