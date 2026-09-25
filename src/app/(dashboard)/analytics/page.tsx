'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TimeSeriesPoint } from '@/types';
import { FollowersChart } from '@/components/charts/FollowersChart';
import { ViewsChart } from '@/components/charts/ViewsChart';
import { EngagementChart } from '@/components/charts/EngagementChart';
import { ReachChart } from '@/components/charts/ReachChart';
import { PostingFrequencyChart } from '@/components/charts/PostingFrequencyChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<{ days: number; hasData: boolean; timeSeries: TimeSeriesPoint[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => !cancelled && setData(json))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const series = data?.timeSeries ?? [];
  const loading = data?.days !== days;

  const timeFilters = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
  ];

  const charts = [
    {
      title: 'Platform Reach',
      subtitle: `Accounts reached by your recent posts (Instagram), last ${days} days`,
      component: <ReachChart data={series} />,
    },
    {
      title: 'Total Views',
      subtitle: `Views across synced posts and channels, last ${days} days`,
      component: <ViewsChart data={series} />,
    },
    {
      title: 'Engagement Rate',
      subtitle: `Average engagement of posts published each day, last ${days} days`,
      component: <EngagementChart data={series} />,
    },
    {
      title: 'Followers Growth',
      subtitle: `Followers across connected accounts, last ${days} days`,
      component: <FollowersChart data={series} />,
    },
    {
      title: 'Posting Frequency',
      subtitle: `Posts published per day, last ${days} days`,
      component: <PostingFrequencyChart data={series} />,
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with time filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep-dive performance graphs across all platforms</p>
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

      {/* Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {charts.map((chart) => (
          <Card
            key={chart.title}
            className={`bg-secondary/20 border-border ${
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
