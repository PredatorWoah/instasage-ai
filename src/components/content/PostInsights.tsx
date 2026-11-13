'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUp, BarChart3, GitCompareArrows } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatLabel } from '@/lib/platform';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export type InsightPost = {
  id: string;
  platform: string;
  type: string;
  caption: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  performanceScore: number;
  username: string;
  avgWatchMs: number | null;
  skipRate: number | null;
  facebookViews?: number | null;
};
export type Averages = Record<'views' | 'reach' | 'likes' | 'comments' | 'saves' | 'shares' | 'engagement', number> & { posts: number; rank: number; avgWatchMs: number | null; skipRate: number | null };

type Row = { key: string; label: string; value: number | null; show: (n: number) => string; lowerIsBetter?: boolean; hint?: string };
type ListPost = { id: string; caption: string; type: string; views: number; publishedAt: string; username: string };

const AVERAGE = 'average';
const whole = (n: number) => formatNumber(Math.round(n));
const pct1 = (n: number) => `${n.toFixed(1)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const title = (p: { caption: string; type: string }) => p.caption.replace(/\s+/g, ' ').trim() || `Untitled ${formatLabel(p.type).toLowerCase()}`;

// The numbers a post has, in one order for every view. YouTube has no saves, shares or reach.
function rowsOf(p: { platform: string; views: number; reach: number | null; likes: number; comments: number; saves: number; shares: number; performanceScore: number; avgWatchMs: number | null; skipRate: number | null }): Row[] {
  const yt = p.platform === 'youtube';
  return [
    { key: 'views', label: 'Views', value: p.views, show: whole },
    ...(yt ? [] : [{ key: 'reach', label: 'Reach', value: p.reach, show: whole, hint: 'accounts that saw it' }]),
    { key: 'likes', label: 'Likes', value: p.likes, show: whole },
    { key: 'comments', label: 'Comments', value: p.comments, show: whole },
    ...(yt ? [] : [{ key: 'saves', label: 'Saves', value: p.saves, show: whole }, { key: 'shares', label: 'Shares', value: p.shares, show: whole }]),
    { key: 'engagement', label: 'Engagement', value: p.performanceScore, show: pct1, hint: yt ? 'likes and comments per view' : 'interactions per account reached' },
    { key: 'watch', label: 'Avg watch time', value: p.avgWatchMs, show: secs },
    { key: 'skip', label: 'Skip rate', value: p.skipRate, show: (n: number) => `${n.toFixed(0)}%`, lowerIsBetter: true },
  ];
}

const tile = 'p-3 rounded-lg border border-border bg-secondary/15 min-w-0';
const label = 'text-[10px] uppercase tracking-wider text-muted-foreground';

// A post's numbers on their own (Insights), or next to your average or any other post (Compare)
export function PostInsights({ post, averages, initialVs }: { post: InsightPost; averages: Averages; initialVs?: string }) {
  const [mode, setMode] = useState<'insights' | 'compare'>(initialVs ? 'compare' : 'insights');
  const [vs, setVs] = useState(initialVs || AVERAGE);
  const yt = post.platform === 'youtube';
  const mine = rowsOf(post).filter((r) => r.value != null);
  const interactions = [
    { label: 'Likes', value: post.likes, color: 'bg-rose-400' },
    { label: 'Comments', value: post.comments, color: 'bg-indigo-400' },
    ...(yt ? [] : [{ label: 'Saves', value: post.saves, color: 'bg-amber-400' }, { label: 'Shares', value: post.shares, color: 'bg-emerald-400' }]),
  ];
  const total = interactions.reduce((a, x) => a + x.value, 0);
  const per1000 = (n: number) => (post.reach ? (n / post.reach) * 1000 : null);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="How to look at this post" className="inline-flex gap-1 p-1 rounded-full bg-ink/[0.05] border border-ink/[0.06]">
        {([['insights', 'Insights', BarChart3], ['compare', 'Compare', GitCompareArrows]] as const).map(([id, text, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn('inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-bold transition-colors', mode === id ? 'bg-ink text-background' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="w-4 h-4" /> {text}
          </button>
        ))}
      </div>

      {mode === 'insights' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
            {mine.map((r) => (
              <div key={r.key} className={tile}>
                <p className={label}>{r.label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{r.show(r.value!)}</p>
                {r.hint && <p className="text-[10px] text-muted-foreground leading-snug">{r.hint}</p>}
              </div>
            ))}
            {post.facebookViews != null && post.facebookViews > 0 && (
              <div className={tile}>
                <p className={label}>On Facebook</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{formatNumber(post.facebookViews)}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{post.type === 'reel' ? 'included in views' : 'part of views'} · {Math.round((post.facebookViews / Math.max(1, post.views)) * 100)}% of the total</p>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className={cn(tile, 'space-y-2.5')}>
              <p className={label}>{formatNumber(total)} interactions, by kind</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-ink/[0.06]" role="img" aria-label={interactions.map((x) => `${x.label} ${Math.round((x.value / total) * 100)}%`).join(', ')}>
                {interactions.filter((x) => x.value > 0).map((x) => <span key={x.label} className={x.color} style={{ width: `${(x.value / total) * 100}%` }} />)}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {interactions.map((x) => (
                  <li key={x.label} className="inline-flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-sm', x.color)} />
                    <span className="text-muted-foreground">{x.label}</span>
                    <span className="font-bold tabular-nums">{Math.round((x.value / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
              {!yt && post.reach != null && post.reach > 0 && (
                <p className="text-[12px] text-muted-foreground leading-snug">
                  Out of every 1,000 accounts reached: <b className="text-foreground tabular-nums">{per1000(post.likes)!.toFixed(0)}</b> liked, <b className="text-foreground tabular-nums">{per1000(post.saves)!.toFixed(1)}</b> saved, <b className="text-foreground tabular-nums">{per1000(post.shares)!.toFixed(1)}</b> shared, <b className="text-foreground tabular-nums">{per1000(post.comments)!.toFixed(1)}</b> commented.
                  {post.views > 0 && <> Each account watched it about <b className="text-foreground tabular-nums">{(post.views / post.reach).toFixed(1)}</b> times.</>}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <Compare post={post} averages={averages} vs={vs} setVs={setVs} />
      )}
    </div>
  );
}

function Compare({ post, averages, vs, setVs }: { post: InsightPost; averages: Averages; vs: string; setVs: (v: string) => void }) {
  const { data: all } = useCachedJson<ListPost[] | null>('/api/posts');
  const others = (all ?? []).filter((p) => p.id !== post.id && p.username === post.username);
  const [other, setOther] = useState<{ id: string; post: InsightPost | null; error: boolean } | null>(null);

  useEffect(() => {
    if (vs === AVERAGE) return;
    let cancelled = false;
    fetch(`/api/posts/${encodeURIComponent(vs)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => !cancelled && setOther({ id: vs, post: body?.post ?? null, error: !body?.post }))
      .catch(() => !cancelled && setOther({ id: vs, post: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [vs]);

  const loaded = vs !== AVERAGE && other?.id === vs ? other : null;
  const theirs: Row[] | null = vs === AVERAGE
    ? rowsOf({ platform: post.platform, views: averages.views, reach: averages.reach || null, likes: averages.likes, comments: averages.comments, saves: averages.saves, shares: averages.shares, performanceScore: averages.engagement, avgWatchMs: averages.avgWatchMs, skipRate: averages.skipRate })
    : loaded?.post ? rowsOf(loaded.post) : null;
  const mine = rowsOf(post);
  const otherName = vs === AVERAGE ? 'Your average' : 'Other post';

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold">Compare this post with</span>
        <select value={vs} onChange={(e) => setVs(e.target.value)} className="glass-field w-full h-11 rounded-xl px-3 text-[13px] font-semibold">
          <option value={AVERAGE}>Your average ({averages.posts} {post.platform === 'youtube' ? 'videos' : 'posts'})</option>
          {vs !== AVERAGE && !others.some((p) => p.id === vs) && <option value={vs}>The selected post</option>}
          {others.map((p) => <option key={p.id} value={p.id}>{day(p.publishedAt)} · {formatLabel(p.type)} · {formatNumber(p.views)} views · {title(p).slice(0, 50)}</option>)}
        </select>
      </label>
      {all === undefined && <p className="text-[12px] text-muted-foreground">Loading your other posts…</p>}
      {all !== undefined && others.length === 0 && <p className="text-[12px] text-muted-foreground">No other posts from @{post.username} to compare with yet.</p>}

      {loaded?.post && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[post, loaded.post].map((p, i) => (
            <Link key={p.id} href={`/content/${encodeURIComponent(p.id)}`} className={cn(tile, 'flex items-center gap-2.5 hover:bg-ink/[0.06] transition-colors')}>
              <span className="on-color relative w-10 h-12 rounded-md overflow-hidden shrink-0 bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]">
                {p.thumbnail && <Image src={p.thumbnail} alt="" fill unoptimized sizes="40px" className="object-cover" />}
              </span>
              <span className="min-w-0">
                <span className={cn(label, 'block', i === 0 ? 'text-indigo-400' : 'text-amber-400')}>{i === 0 ? 'This post' : 'Other post'}</span>
                <span className="text-[12.5px] font-semibold leading-snug line-clamp-2 break-words">{title(p)}</span>
                <span className="block text-[11px] text-muted-foreground">{formatLabel(p.type)} · {day(p.publishedAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {vs !== AVERAGE && !loaded ? (
        <div className="h-64 rounded-lg bg-secondary/15 animate-pulse" aria-label="Loading the other post" />
      ) : loaded?.error || !theirs ? (
        <p role="alert" className="text-[13px] text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5">That post did not load. It may have been removed from Instagram. Pick another one.</p>
      ) : (
        <div className={cn(tile, 'p-0 overflow-hidden')}>
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3 px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Metric</span>
            <span className="text-indigo-400">This post</span>
            <span className="text-amber-400">{otherName}</span>
            <span className="w-14 text-right">Diff</span>
          </div>
          {mine.map((m) => {
            const t = theirs.find((x) => x.key === m.key);
            if (m.value == null && t?.value == null) return null;
            const a = m.value;
            const b = t?.value ?? null;
            const both = a != null && b != null;
            const diff = both && b > 0 ? ((a - b) / b) * 100 : null;
            const good = diff == null || diff === 0 ? null : m.lowerIsBetter ? diff < 0 : diff > 0;
            const max = Math.max(a ?? 0, b ?? 0) || 1;
            return (
              <div key={m.key} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3 items-center px-3 py-2.5 border-b border-border/60 last:border-b-0">
                <span className="text-[12.5px] font-semibold leading-snug">{m.label}</span>
                {[[a, 'bg-indigo-400'], [b, 'bg-amber-400']].map(([v, color], i) => (
                  <span key={i} className="min-w-0">
                    <span className="block text-[13.5px] font-bold tabular-nums">{v == null ? <span className="text-muted-foreground font-normal">not reported</span> : m.show(v as number)}</span>
                    <span className="block h-1.5 rounded-full bg-ink/[0.06] mt-1 overflow-hidden" aria-hidden>
                      {v != null && <span className={cn('block h-full rounded-full', color as string)} style={{ width: `${Math.max(3, ((v as number) / max) * 100)}%` }} />}
                    </span>
                  </span>
                ))}
                <span className={cn('w-14 inline-flex items-center justify-end gap-0.5 text-[12px] font-bold tabular-nums', good == null ? 'text-muted-foreground' : good ? 'text-emerald-400' : 'text-rose-400')}>
                  {diff == null ? (both && a === b ? 'same' : '') : diff === 0 ? 'same' : <>{diff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{Math.abs(diff) >= 1000 ? '999+' : Math.abs(diff).toFixed(0)}%</>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {vs === AVERAGE && averages.rank > 0 && <p className="text-[12.5px] font-semibold">By engagement, this is #{averages.rank} of your {averages.posts} {post.platform === 'youtube' ? 'videos' : 'posts'}.</p>}
      <p className="text-[11.5px] text-muted-foreground leading-snug">Diff is this post against {vs === AVERAGE ? 'your average' : 'the other post'}. Green means this post did better (for skip rate, lower is better). A newer post is still collecting views, so compare posts of a similar age when you can.</p>
    </div>
  );
}
