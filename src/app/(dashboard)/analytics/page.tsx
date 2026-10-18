'use client';

import { useState } from 'react';
import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import Link from 'next/link';
import type { TimeSeriesPoint } from '@/types';
import { FunnelCard, type FunnelData } from '@/components/charts/FunnelCard';
import { PeriodCompare } from '@/components/charts/PeriodCompare';
import { EngagementChart, FollowersChart, PostingFrequencyChart, ReachChart, ViewsChart } from '@/components/charts/LazyCharts';
import type { PeriodTotals } from '@/services/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const { data } = useCachedJson<{ days: number; hasData: boolean; timeSeries: TimeSeriesPoint[]; funnel: FunnelData | null; compare?: { current: PeriodTotals; previous: PeriodTotals } } | null>(`/api/analytics?days=${days}`);

  const { t } = usePlatform();
  const series = data?.timeSeries ?? [];
  const loading = data === undefined;

  const timeFilters = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
  ];

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
      subtitle: `Views on the ${t.posts} published each day, last ${days} days`,
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
      subtitle: `${t.Posts} published per day, last ${days} days`,
      component: <PostingFrequencyChart data={series} label={t.Posts} />,
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with time filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Analytics</h1>
          <p className="text-[15px] text-muted-foreground mt-3">{t.yt ? 'How your channel is growing, day by day' : 'Deep-dive performance graphs across all platforms'}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-secondary/40 p-1 rounded-lg border border-border self-start shrink-0">
          {timeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={days === filter.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDays(filter.value)}
              className="text-xs h-7 px-3"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {data && !data.hasData && (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
          No data yet. Connect an account and press Sync on the{' '}
          <Link href="/accounts" className="text-indigo-400 hover:underline">Accounts page</Link>. Follower and reach
          history builds up with each sync, so these charts fill in over time.
        </p>
      )}

      {data?.hasData && data.compare && (
        <PeriodCompare current={data.compare.current} previous={data.compare.previous} days={data.days} labels={{ posts: t.posts, followers: t.followers, yt: t.yt }} />
      )}

      {!t.yt && data?.funnel && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">From seeing you to following you</CardTitle>
            <p className="text-[11px] text-muted-foreground">Last 30 days on Instagram. The biggest drop is where to focus: hooks for reach to engagement, profile and bio for visits to follows.</p>
          </CardHeader>
          <CardContent className="px-4 pb-4"><FunnelCard funnel={data.funnel} /></CardContent>
        </Card>
      )}

      {/* Grid */}
      <div className={`stagger grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {charts.map((chart) => (
          <Card
            key={chart.title}
            className={`bg-card border-border ${
              chart.fullWidth ? 'md:col-span-2' : ''
            }`}
          >
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{chart.title}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{chart.subtitle}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {chart.component}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
