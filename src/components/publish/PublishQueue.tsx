'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, CircleAlert, ExternalLink, Loader2, Send } from 'lucide-react';
import { refreshJson, useCachedJson } from '@/lib/useCachedJson';
import { formatLabel } from '@/lib/platform';
import { cn } from '@/lib/utils';
import type { PostView } from '@/services/publish';
import { btn } from '@/components/create/ui';
import { PublishModal, QUEUE_URL, recentTick, type Queue } from './PublishModal';

const KIND: Record<string, string> = { image: 'Photo', carousel: 'Carousel', reel: 'Reel', story: 'Story' };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const first = (p: PostView) => p.caption.split('\n')[0].trim() || `${KIND[p.kind] ?? formatLabel(p.kind)} with no caption`;

// What is waiting to go out, what is on its way, what failed and what went out lately
export function PublishQueue({ account }: { account?: string }) {
  const { data, refresh } = useCachedJson<Queue | null>(QUEUE_URL);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const posts = (data?.posts ?? []).filter((p) => !account || p.accountId === account);
  const waiting = posts.filter((p) => p.status === 'scheduled' || p.status === 'processing');
  const failed = posts.filter((p) => p.status === 'failed');
  const done = posts.filter((p) => p.status === 'published').sort((a, b) => Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt)).slice(0, 5);

  const act = async (p: PostView, method: 'PATCH' | 'DELETE', body?: object) => {
    setBusy(p.id);
    const res = await fetch(`${QUEUE_URL}/${p.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const out = (await res?.json().catch(() => ({}))) as { error?: string; post?: PostView };
    if (!res?.ok) toast.error(out?.error || 'That did not work. Try again.');
    else if (out.post?.status === 'published') toast.success('Posted');
    else if (out.post?.status === 'failed') toast.error('It did not go out', { description: out.post.error ?? undefined });
    refreshJson('/api/ideas/saved');
    await refresh();
    setBusy(null);
  };

  if (data === undefined) return <div className="h-28 rounded-[30px] glass-panel animate-pulse" aria-label="Loading your posting queue" />;

  return (
    <section className="glass-panel rounded-[30px] p-5 sm:p-6 flex flex-col gap-4 min-w-0" aria-label="Posting queue">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] tracking-[-0.03em] leading-tight">Posting</h2>
          <p className="text-[13.5px] text-muted-foreground mt-1 leading-snug">
            {data === null ? 'The queue did not load. Check your connection and open this tab again.'
              : waiting.length ? `${waiting.length} on the way.` : 'Nothing waiting to go out.'}
            {data && !recentTick(data) && waiting.some((p) => p.scheduledFor) && <> Scheduled posts go out when you open InstaSage or at the morning sync until the 5 minute scheduler is set up in <a href="/settings#posting" className="underline underline-offset-2">Settings</a>.</>}
          </p>
        </div>
        <button type="button" onClick={() => setComposing(true)} className={cn(btn.primary, 'shrink-0 self-start')}><Send className="w-4 h-4" /> New post</button>
      </div>

      {data && !data.allowed && failed.some((p) => p.code === 'needs_publish_permission') && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-[13px] flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="flex-1">Instagram has not allowed InstaSage to post yet. Allow it once, then retry.</span>
          <a href="/api/connect/instagram?publish=1" className={`${btn.small} self-start`}>Allow posting</a>
        </div>
      )}

      {[...failed, ...waiting].length > 0 && (
        <ul className="flex flex-col gap-2">
          {[...failed, ...waiting].map((p) => (
            <li key={p.id} className="rounded-2xl glass-field p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', p.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-indigo-500/15 text-indigo-400')}>
                {p.status === 'failed' ? <CircleAlert className="w-4 h-4" /> : p.status === 'processing' || !p.scheduledFor ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug break-words line-clamp-2">{first(p)}</p>
                <p className={cn('text-[12px] leading-snug break-words', p.status === 'failed' ? 'text-rose-400' : 'text-muted-foreground')}>
                  {KIND[p.kind]} · {p.media.length} {p.media.length === 1 ? 'file' : 'files'} · {p.status === 'failed' ? p.error : p.status === 'processing' ? 'Instagram is preparing it' : p.scheduledFor ? `goes out ${when(p.scheduledFor)}` : 'sending now'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {p.status === 'failed' && <button type="button" disabled={busy === p.id} onClick={() => act(p, 'PATCH', { retry: true })} className={btn.small}>{busy === p.id ? 'Retrying…' : 'Retry now'}</button>}
                {p.status === 'scheduled' && p.scheduledFor && <button type="button" disabled={busy === p.id} onClick={() => act(p, 'PATCH', { now: true })} className={btn.small}>{busy === p.id ? 'Sending…' : 'Post now'}</button>}
                {(p.status === 'scheduled' || p.status === 'failed') && <button type="button" disabled={busy === p.id} onClick={() => act(p, 'DELETE')} className={btn.small}>{p.status === 'failed' ? 'Remove' : 'Cancel'}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-muted-foreground">Posted from here lately</span>
          <ul className="flex flex-col gap-1.5">
            {done.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-[13px] min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate flex-1 min-w-0">{first(p)}</span>
                <span className="text-[12px] text-muted-foreground shrink-0">{p.publishedAt ? when(p.publishedAt) : ''}</span>
                {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label="Open on Instagram" className="text-indigo-400 shrink-0"><ExternalLink className="w-4 h-4" /></a>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {composing && <PublishModal account={account} onClose={() => { setComposing(false); refreshJson(QUEUE_URL); refreshJson('/api/ideas/saved'); }} />}
    </section>
  );
}
