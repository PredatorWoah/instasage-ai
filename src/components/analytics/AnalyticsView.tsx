'use client';

import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import Link from 'next/link';
import type { TimeSeriesPoint } from '@/types';
import { FunnelCard, type FunnelData } from '@/components/charts/FunnelCard';
import { PeriodCompare } from '@/components/charts/PeriodCompare';
import { EngagementChart, FollowersChart, PostingFrequencyChart, ReachChart, ViewsChart } from '@/components/charts/LazyCharts';
import type { PeriodTotals } from '@/services/dashboard';
import { MessageCircle } from 'lucide-react';
import { SageNote } from '@/components/ai-assistant/SageNote';
import { askSage } from '@/lib/askSage';
import { Button } from '@/components/ui/button';
import { setPeriod, usePeriod } from '@/lib/usePeriod';

export function AnalyticsView() {
  const period = usePeriod();
  const { data } = useCachedJson<{ days: number; allTime?: boolean; hasData: boolean; timeSeries: TimeSeriesPoint[]; funnel: FunnelData | null; compare?: { current: PeriodTotals; previous: PeriodTotals } } | null>('/api/analytics');
  const days = data?.days ?? period.days ?? 30;

  const { t } = usePlatform();
  const series = data?.timeSeries ?? [];
  const loading = data === undefined;

  // Shortcuts for the top bar's time window (the picker there also takes any number of days)
  const timeFilters: { label: string; value: number | null }[] = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
    { label: 'All', value: null },
  ];
  const gained = data?.compare?.current.followersGained ?? null;
  const span = period.days == null ? 'all time' : `last ${days} days`;

  const charts = [
    t.yt
      ? {
          title: 'Channel views gained',
          subtitle: 'Views across the whole channel each day, worked out from daily syncs (starts once two syncs exist)',
          component: <ReachChart data={series} dataKey="channelViews" label="Channel views" />,
        }
      : {
          title: 'Platform Reach',
          subtitle: 'Accounts your Instagram reached each day (Instagram keeps 30 days of history)',
          component: <ReachChart data={series} />,
        },
    {
      title: 'Total Views',
      subtitle: `Views on the ${t.posts} published each day, ${span}`,
      component: <ViewsChart data={series} />,
    },
    {
      title: 'Engagement Rate',
      subtitle: `Engagement (${t.engagementNote}) of ${t.posts} published each day vs your average`,
      component: <EngagementChart data={series} />,
    },
    {
      title: `${t.followers} Growth`,
      subtitle: t.yt ? 'Subscriber count per day, one snapshot per sync' : 'Follower count per day, rebuilt from Instagram\'s daily new followers',
      component: <FollowersChart data={series} label={t.followers} />,
    },
    {
      title: 'Posting Frequency',
      subtitle: `${t.Posts} published per day, ${span}`,
      component: <PostingFrequencyChart data={series} label={t.Posts} />,
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with time filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {gained != null && <p className="text-[14px] font-bold text-muted-foreground mb-1.5">Are you growing?</p>}
          <h1 className="font-display font-extrabold text-[44px] sm:text-[72px] leading-[0.9] tracking-[-0.05em]">
            {gained == null ? 'Analytics.' : gained > 0 ? <>Yes. <span className="text-emerald-400">+{gained.toLocaleString('en-US')}.</span></> : gained < 0 ? <>Not right now. <span className="text-rose-400">{gained.toLocaleString('en-US')}.</span></> : 'Holding steady.'}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">{gained == null ? (t.yt ? 'How your channel is growing, day by day' : 'How your account is growing, day by day') : `${t.followers} gained over ${span}. The charts below show where it came from.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border self-start max-w-full">
          {timeFilters.map((filter) => (
            <Button
              key={filter.label}
              variant={period.days === filter.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => period.days !== filter.value && setPeriod(filter.value)}
              className="text-xs h-7 px-3"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-card border border-border/60 animate-pulse p-4 space-y-2.5">
                <div className="w-16 h-3 bg-ink/[0.08] rounded" />
                <div className="w-24 h-6 bg-ink/[0.12] rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <div className="w-28 h-4 bg-ink/[0.08] rounded" />
                <div className="w-48 h-3 bg-ink/[0.05] rounded" />
                <div className="h-[200px] rounded-xl bg-ink/[0.03] animate-pulse flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border-2 border-ink/[0.15] border-t-indigo-400 animate-spin" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {data && !data.hasData && (
            <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
              No data yet. Connect an account and press Sync on the{' '}
              <Link href="/accounts" className="text-indigo-400 hover:underline">Accounts page</Link>. Follower and reach
              history builds up with each sync, so these charts fill in over time.
            </p>
          )}

          {data?.hasData && <SageNote page="analytics" />}

          {data?.hasData && data.compare && !data.allTime && (
            <PeriodCompare current={data.compare.current} previous={data.compare.previous} days={data.days} labels={{ posts: t.posts, followers: t.followers, yt: t.yt }} />
          )}

          {!t.yt && data?.funnel && (
            <ChartCard title="From seeing you to following you" subtitle="Last 30 days on Instagram. The biggest drop is where to focus: hooks for reach to engagement, profile and bio for visits to follows." ask={`Look at my funnel from reach to follows. Where is the biggest drop, and what should I change?`}>
              <FunnelCard funnel={data.funnel} />
            </ChartCard>
          )}

          {/* Grid */}
          <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map((chart) => (
              <ChartCard
                key={chart.title}
                title={chart.title}
                subtitle={chart.subtitle}
                wide={chart.fullWidth}
                ask={`Explain my "${chart.title}" chart for ${period.label.toLowerCase()}: what is the trend, what is behind it, and what should I do?`}
              >
                {chart.component}
              </ChartCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// One chart in the overhauled grid, with Sage a tap away
function ChartCard({ title, subtitle, ask, wide, children }: { title: string; subtitle: string; ask: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-[30px] bg-card border border-ink/[0.05] p-4 sm:p-5 flex flex-col gap-3 min-w-0 ${wide ? 'md:col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">{subtitle}</p>
        </div>
        <button type="button" onClick={() => askSage(ask)} aria-label={`Ask Sage about ${title}`} title="Ask Sage about this chart" className="shrink-0 w-10 h-10 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 flex items-center justify-center transition-colors">
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
