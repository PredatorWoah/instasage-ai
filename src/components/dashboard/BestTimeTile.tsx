'use client';

import { useMemo } from 'react';
import { useCachedJson } from '@/lib/useCachedJson';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Slot = { day: string; hour: string; engagement: number; posts: number };

// Nebula-style glowing tile: the weekday + hour your posts do best, in the viewer's own timezone
export function BestTimeTile() {
  const { data: posts } = useCachedJson<{ publishedAt: string; performanceScore: number }[]>('/api/posts');

  const slot = useMemo<Slot | null | undefined>(() => {
    if (posts === undefined) return undefined;
    if (!posts || posts.length < 3) return null;
    const buckets = new Map<string, { total: number; count: number; day: number; hour: number }>();
    for (const p of posts) {
      const d = new Date(p.publishedAt);
      // Group into 3-hour windows so a handful of posts still gives a signal
      const hour = Math.floor(d.getHours() / 3) * 3;
      const key = `${d.getDay()}-${hour}`;
      const b = buckets.get(key) ?? { total: 0, count: 0, day: d.getDay(), hour };
      b.total += p.performanceScore;
      b.count += 1;
      buckets.set(key, b);
    }
    const best = [...buckets.values()]
      .filter((b) => b.count >= (posts.length >= 12 ? 2 : 1))
      .sort((a, b) => b.total / b.count - a.total / a.count)[0];
    if (!best) return null;
    const fmt = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
    return { day: DAYS[best.day], hour: fmt(best.hour), engagement: best.total / best.count, posts: best.count };
  }, [posts]);

  return (
    <div className="relative overflow-hidden p-5 rounded-[30px] bg-card border border-[rgba(244,114,182,0.25)] flex flex-col justify-between min-h-[190px]">
      <div aria-hidden className="absolute -left-16 -bottom-20 w-56 h-56 rounded-full bg-[radial-gradient(closest-side,rgba(244,114,182,0.4),transparent)]" />
      <span className="relative self-start px-3 py-1.5 rounded-full bg-white/[0.07] text-[13px] font-bold text-[#FFB3D1]">Best time to post</span>
      {slot === undefined ? (
        <div className="relative h-16 w-32 rounded-2xl bg-white/5 animate-pulse" />
      ) : slot ? (
        <div className="relative">
          <div className="font-display font-extrabold text-[44px] leading-[0.95] tracking-[-0.04em]">
            {slot.day}<br />{slot.hour}
          </div>
          <p className="text-[12px] text-muted-foreground mt-2">
            {slot.engagement.toFixed(1)}% avg engagement · {slot.posts} post{slot.posts === 1 ? '' : 's'}
          </p>
        </div>
      ) : (
        <p className="relative text-sm text-muted-foreground">Sync a few posts to find your best slot.</p>
      )}
    </div>
  );
}
