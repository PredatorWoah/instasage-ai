'use client';

import { useState } from 'react';
import {
  mockFollowersTimeSeries,
  mockViewsTimeSeries,
  mockEngagementTimeSeries,
  mockReachTimeSeries,
  mockPostingFrequency,
} from '@/data/mockMetrics';
import { FollowersChart } from '@/components/charts/FollowersChart';
import { ViewsChart } from '@/components/charts/ViewsChart';
import { EngagementChart } from '@/components/charts/EngagementChart';
import { ReachChart } from '@/components/charts/ReachChart';
import { PostingFrequencyChart } from '@/components/charts/PostingFrequencyChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);

  // Slice datasets based on selected time filter (last N days of 365 days available)
  const filterData = <T,>(data: T[]): T[] => {
    return data.slice(-days);
  };

  const timeFilters = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
  ];

  const charts = [
    {
      title: 'Platform Reach',
      subtitle: `Unique accounts reached over last ${days} days`,
      component: <ReachChart data={filterData(mockReachTimeSeries)} />,
    },
    {
      title: 'Total Views',
      subtitle: `Video + post views over last ${days} days`,
      component: <ViewsChart data={filterData(mockViewsTimeSeries)} />,
    },
    {
      title: 'Engagement Rate',
      subtitle: `% engagement over last ${days} days`,
      component: <EngagementChart data={filterData(mockEngagementTimeSeries)} />,
    },
    {
      title: 'Followers Growth',
      subtitle: `Total followers trend over last ${days} days`,
      component: <FollowersChart data={filterData(mockFollowersTimeSeries)} />,
    },
    {
      title: 'Posting Frequency',
      subtitle: `Posts published per day over last ${days} days`,
      component: <PostingFrequencyChart data={filterData(mockPostingFrequency)} />,
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
