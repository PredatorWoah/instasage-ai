'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCKS = Array.from({ length: 8 }, (_, i) => i * 3);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

type Cell = { total: number; count: number };

// Weekday by 3 hour block: brighter means higher average engagement, the number is how many posts
// went up then. Empty cells are slots you have never tried, which are worth an experiment.
export function BestTimeHeatmap({ posts, noun }: { posts: { publishedAt: string; performanceScore: number }[]; noun: string }) {
  const { grid, max, best } = useMemo(() => {
    const grid: Cell[][] = DAYS.map(() => BLOCKS.map(() => ({ total: 0, count: 0 })));
    for (const p of posts) {
      const d = new Date(p.publishedAt);
      const cell = grid[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 3)];
      cell.total += p.performanceScore;
      cell.count += 1;
    }
    const avgs = grid.flat().filter((c) => c.count).map((c) => c.total / c.count);
    const minPosts = posts.length >= 20 ? 2 : 1;
    let best: { day: number; block: number; avg: number } | null = null;
    grid.forEach((row, day) => row.forEach((c, block) => {
      if (c.count >= minPosts && (!best || c.total / c.count > best.avg)) best = { day, block, avg: c.total / c.count };
    }));
    return { grid, max: Math.max(0.01, ...avgs), best: best as { day: number; block: number; avg: number } | null };
  }, [posts]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid grid-cols-[36px_repeat(8,minmax(34px,1fr))] gap-1 min-w-[340px]">
          <span />
          {BLOCKS.map((h) => <span key={h} className="text-[10px] text-muted-foreground text-center">{hourLabel(h)}</span>)}
          {grid.map((row, day) => (
            <div key={DAYS[day]} className="contents">
              <span className="text-[11px] text-muted-foreground self-center">{DAYS[day]}</span>
              {row.map((c, block) => {
                const avg = c.count ? c.total / c.count : 0;
                const isBest = best?.day === day && best.block === block;
                return (
                  <div
                    key={block}
                    title={c.count ? `${DAYS[day]} ${hourLabel(BLOCKS[block])} to ${hourLabel((BLOCKS[block] + 3) % 24)}: ${avg.toFixed(1)}% avg engagement over ${c.count} ${noun}` : `${DAYS[day]} ${hourLabel(BLOCKS[block])}: nothing posted yet`}
                    className={cn('h-8 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums', c.count ? 'text-white' : 'border border-dashed border-ink/[0.07]', isBest && 'ring-2 ring-[#4ADE9E]')}
                    style={c.count ? { background: `rgba(74, 222, 158, ${0.12 + 0.78 * (avg / max)})` } : undefined}
                  >
                    {c.count || ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {best ? `Best slot so far: ${DAYS[best.day]} ${hourLabel(BLOCKS[best.block])} to ${hourLabel((BLOCKS[best.block] + 3) % 24)} (${best.avg.toFixed(1)}%). ` : ''}
        Brighter means higher engagement, the number is how many {noun} went up then. Dashed slots are untested.
      </p>
    </div>
  );
}
