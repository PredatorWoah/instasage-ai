import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';
import type { PeriodTotals } from '@/services/dashboard';

type Tile = { label: string; now: number | null; before: number | null; fmt: (n: number) => string; points?: boolean };

// Each headline number for the chosen window, with the change against the window before it
export function PeriodCompare({ current, previous, days, labels }: {
  current: PeriodTotals;
  previous: PeriodTotals;
  days: number;
  labels: { posts: string; followers: string; yt: boolean };
}) {
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${formatNumber(Math.abs(n))}`;
  const tiles: Tile[] = [
    { label: `${labels.followers} gained`, now: current.followersGained, before: previous.followersGained, fmt: signed },
    ...(labels.yt ? [] : [{ label: 'Reach', now: current.reach, before: previous.reach, fmt: formatNumber }]),
    { label: `Views on new ${labels.posts}`, now: current.views, before: previous.views, fmt: formatNumber },
    { label: 'Avg engagement', now: current.engagement, before: previous.engagement, fmt: (n) => `${n.toFixed(1)}%`, points: true },
    { label: `${labels.posts[0].toUpperCase()}${labels.posts.slice(1)} published`, now: current.posts, before: previous.posts, fmt: (n) => String(n) },
  ];
  return (
    <div className={cn('grid grid-cols-2 gap-2', labels.yt ? 'sm:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-5')}>
      {tiles.map((t) => {
        // Engagement compares in percentage points; the rest as a percent change
        const diff = t.now == null || t.before == null ? null : t.points ? t.now - t.before : t.before !== 0 ? ((t.now - t.before) / Math.abs(t.before)) * 100 : null;
        const up = diff != null && diff >= 0;
        return (
          <div key={t.label} className="rounded-2xl bg-card border border-ink/[0.05] px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
            <p className="font-display font-extrabold text-[24px] leading-tight tabular-nums">{t.now == null ? '—' : t.fmt(t.now)}</p>
            <p className={cn('text-[11px] flex items-center gap-0.5 tabular-nums', diff == null ? 'text-muted-foreground' : up ? 'text-emerald-400' : 'text-rose-400')}>
              {diff != null && (up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              {diff != null ? `${Math.abs(diff).toFixed(t.points ? 1 : 0)}${t.points ? ' pts' : '%'}` : t.before != null ? `was ${t.fmt(t.before)}` : 'no earlier data'}
              <span className="text-muted-foreground ml-1">vs previous {days}d</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
