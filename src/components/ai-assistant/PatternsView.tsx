'use client';

import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { formatLabel } from '@/lib/platform';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { GroupStat } from '@/services/analysis';

type Patterns = {
  totals: { organicPosts: number; avgViews: number; avgEngagement: number; boostedPosts: number };
  momentum: { recentViews: number; earlierViews: number; recentEngagement: number; earlierEngagement: number } | null;
  cadence: { postsPerWeek: number[]; avgGapDays: number | null; longestGapDays: number | null; daysSinceLast: number | null }; // postsPerWeek: last 8 weeks, oldest first
  dimensions: { key: string; title: string; groups: GroupStat[] }[];
} | null;

const FEW = 3; // fewer posts than this in a group is a hint, not a pattern

function Dimension({ title, groups, label, noun }: { title: string; groups: GroupStat[]; label: (s: string) => string; noun: string }) {
  const sorted = [...groups].sort((a, b) => b.viewsLift - a.viewsLift);
  const max = Math.max(1, ...sorted.map((g) => Math.abs(g.viewsLift)));
  return (
    <div className="rounded-[24px] bg-card border border-ink/[0.05] p-4 space-y-2.5">
      <p className="text-sm font-bold">{title}</p>
      <ul className="space-y-1.5">
        {sorted.map((g) => {
          const up = g.viewsLift >= 0;
          return (
            <li key={g.label} className={cn('grid grid-cols-[minmax(0,1fr)_88px_52px] items-center gap-2 text-[12px]', g.posts < FEW && 'opacity-60')} title={`${g.posts} ${noun} · ${formatNumber(g.avgViews)} avg views · ${g.avgEngagement}% avg engagement`}>
              <span className="truncate">{label(g.label)} <span className="text-muted-foreground">· {g.posts}</span></span>
              <span className="relative h-2 rounded-full bg-ink/[0.05] overflow-hidden">
                <span className={cn('absolute top-0 bottom-0 rounded-full', up ? 'left-1/2 bg-emerald-400' : 'right-1/2 bg-rose-400')} style={{ width: `${(Math.abs(g.viewsLift) / max) * 50}%` }} />
              </span>
              <span className={cn('text-right font-bold tabular-nums', up ? 'text-emerald-400' : 'text-rose-400')}>{up ? '+' : ''}{g.viewsLift}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The patterns behind the AI's read, straight from your numbers: works with no AI key at all
export function PatternsView() {
  const { data } = useCachedJson<Patterns>('/api/insights/patterns');
  const { t, mode } = usePlatform();
  if (data === undefined) return <div className="h-64 rounded-[30px] bg-card animate-pulse" />;
  if (!data || data.totals.organicPosts < 3) return null;

  const m = data.momentum;
  const weeks = data.cadence.postsPerWeek;
  const perWeek = weeks.length ? weeks.reduce((a, n) => a + n, 0) / weeks.length : 0;
  const weekMax = Math.max(1, ...weeks);
  const viewsChange = m && m.earlierViews ? Math.round(((m.recentViews - m.earlierViews) / m.earlierViews) * 100) : null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">The numbers behind it</h2>
        <p className="text-[13px] text-muted-foreground">
          Views against your average of {formatNumber(data.totals.avgViews)} per {t.post}, across {data.totals.organicPosts} {t.posts}
          {data.totals.boostedPosts ? ` (${data.totals.boostedPosts} boosted left out)` : ''}. Faded rows have under {FEW} {t.posts}, so treat them as hints. No AI needed.
        </p>
        {mode === 'mixed' && (
          <p className="text-[12px] text-amber-400 mt-1">Instagram and YouTube are mixed here, and their view counts differ a lot. Pick one account in the top bar for a cleaner read.</p>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <div className="rounded-[24px] bg-card border border-ink/[0.05] p-4">
          <p className="text-[11px] text-muted-foreground">Last 10 {t.posts} vs the 10 before</p>
          <p className={cn('font-display font-extrabold text-[26px] tabular-nums', viewsChange == null ? '' : viewsChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {viewsChange == null ? '—' : `${viewsChange >= 0 ? '+' : ''}${viewsChange}%`}
          </p>
          <p className="text-[11px] text-muted-foreground">{m ? `${formatNumber(m.recentViews)} vs ${formatNumber(m.earlierViews)} avg views` : 'Needs 20 posts'}</p>
        </div>
        <div className="rounded-[24px] bg-card border border-ink/[0.05] p-4">
          <p className="text-[11px] text-muted-foreground">Posting rhythm</p>
          <div className="flex items-end justify-between gap-3">
            <p className="font-display font-extrabold text-[26px] tabular-nums">{perWeek.toFixed(1)}<span className="text-[13px] font-bold text-muted-foreground"> / week</span></p>
            <span className="flex items-end gap-0.5 h-8" title="Posts in each of the last 8 weeks">
              {weeks.map((n, i) => <span key={i} className="w-1.5 rounded-sm bg-indigo-400/80" style={{ height: `${Math.max(8, (n / weekMax) * 100)}%`, opacity: n ? 1 : 0.25 }} />)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{data.cadence.avgGapDays != null ? `Every ${data.cadence.avgGapDays} days on average, longest gap ${data.cadence.longestGapDays}` : '—'}</p>
        </div>
        <div className="rounded-[24px] bg-card border border-ink/[0.05] p-4">
          <p className="text-[11px] text-muted-foreground">Since your last {t.post}</p>
          <p className={cn('font-display font-extrabold text-[26px] tabular-nums', data.cadence.daysSinceLast != null && data.cadence.avgGapDays != null && data.cadence.daysSinceLast > data.cadence.avgGapDays * 2 && 'text-amber-400')}>
            {data.cadence.daysSinceLast ?? '—'}<span className="text-[13px] font-bold text-muted-foreground"> days</span>
          </p>
          <p className="text-[11px] text-muted-foreground">Average engagement {data.totals.avgEngagement}%</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
        {data.dimensions.map((d) => (
          <Dimension key={d.key} title={d.title} groups={d.groups} label={d.key === 'format' ? formatLabel : (s) => s} noun={t.posts} />
        ))}
      </div>
    </section>
  );
}
